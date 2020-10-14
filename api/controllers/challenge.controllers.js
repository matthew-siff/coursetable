import graphqurl from 'graphqurl';
const { query } = graphqurl;
import crypto from 'crypto';

import {
  GRAPHQL_ENDPOINT,
  CHALLENGE_SEASON,
  MAX_CHALLENGE_REQUESTS,
} from '../config/constants.js';

import {
  requestEvalsQuery,
  verifyEvalsQuery,
} from '../queries/challenge.queries.js';

import { encrypt, decrypt, getRandomInt } from '../utils.js';

import Student from '../models/student.models.js';

/**
 * Middleware to verify request headers
 *
 * @prop req - express request object
 * @prop res - express response object
 * @prop next - express next object
 */
export const verifyHeaders = (req, res, next) => {
  // get authentication headers
  const netid = req.header('x-coursetable-netid'); // user's NetID
  const authd = req.header('x-coursetable-authd'); // if user is logged in

  // require NetID authentication
  if (authd !== 'true' || !netid) {
    return res.status(401).json({
      error: 'NOT_AUTHENTICATED',
    });
  }

  next();
};

/**
 * Generate a challenge object given a query response.
 * Used by the requestChallenge controller.
 *
 * @prop req - express request object
 * @prop res - express response object
 * @prop evals - evals from the GraphQL query over evaluations
 * @prop challengeTries - number of user attempts
 */
const constructChallenge = (req, res, evals, challengeTries) => {
  // array of course enrollment counts
  let ratingIndices = new Array();

  for (const evaluation_rating of evals['data']['evaluation_ratings']) {
    const ratingIndex = getRandomInt(5); // 5 is the number of rating categories

    if (!Number.isInteger(evaluation_rating['rating'][ratingIndex])) {
      return res.status(500).json({
        error: 'RATINGS_RETRIEVAL_ERROR',
      });
    }
    ratingIndices.push(ratingIndex);
  }

  // array of CourseTable question IDs
  const ratingIds = evals['data']['evaluation_ratings'].map(x => x['id']);

  // construct token object
  const secrets = ratingIds.map((x, index) => {
    return {
      courseRatingId: ratingIds[index],
      courseRatingIndex: ratingIndices[index],
    };
  });

  // encrypt token
  const salt = crypto.randomBytes(16).toString('hex');
  const token = encrypt(JSON.stringify(secrets), salt);

  // course ids, titles and questions for user
  const courseIds = evals['data']['evaluation_ratings'].map(x => x['id']);
  const courseTitles = evals['data']['evaluation_ratings'].map(
    x => x['course']['title']
  );
  const courseQuestionTexts = evals['data']['evaluation_ratings'].map(
    x => x['evaluation_question']['question_text']
  );

  // Yale OCE urls for user to retrieve answers
  const oceUrls = evals['data']['evaluation_ratings'].map(x => {
    // courses have multiple CRNs, and any one should be fine
    const crn = x['course']['listings'][0]['crn'];
    const season = x['course']['season_code'];

    const oceUrl = `https://oce.app.yale.edu/oce-viewer/studentSummary/index?crn=${crn}&term_code=${season}`;

    return oceUrl;
  });

  // merged course information object
  const course_info = courseTitles.map((x, index) => {
    return {
      courseId: courseIds[index],
      courseTitle: courseTitles[index],
      courseRatingIndex: ratingIndices[index],
      courseQuestionTexts: courseQuestionTexts[index],
      courseOceUrl: oceUrls[index],
    };
  });

  return res.json({
    body: {
      token: token,
      salt: salt,
      course_info: course_info,
    },
    challengeTries: challengeTries + 1,
  });
};

/**
 * Generates and returns a user challenge.
 * @prop req - request object
 * @prop res - return object
 */
export const requestChallenge = (req, res) => {
  const netid = req.header('x-coursetable-netid'); // user's NetID

  const student = new Student();

  Student.getChallengeStatus(netid, (statusCode, err, data) => {
    if (err) {
      return res.status(statusCode).json({
        error: err,
      });
    }

    const challengeTries = data['challengeTries'];

    Student.incrementChallengeTries(
      challengeTries,
      netid,
      (statusCode, err, data) => {
        if (err) {
          return res.status(statusCode).json({
            error: err,
            challengeTries: challengeTries + 1,
          });
        }

        // randomize the selected challenge courses by
        // randomly choosing a minimum rating
        const minRating = 1 + Math.random() * 4;

        console.log('hello!');

        query({
          query: requestEvalsQuery,
          endpoint: GRAPHQL_ENDPOINT,
          variables: {
            season: CHALLENGE_SEASON,
            minRating: minRating,
          },
        })
          .then(evals => {
            return constructChallenge(req, res, evals, challengeTries);
          })
          .catch(err => {
            return res.status(500).json({
              error: err,
              challengeTries: challengeTries + 1,
            });
          });
      }
    );
  });
};

/**
 * Compare a response from the database and user-provided answers
 * to verify that a challenge is solved or not. Used by the
 * verifyChallenge controller.
 *
 * @prop true_evals - response from the GraphQL query over the evaluations
 * @prop answers - user-provided answers
 */
const checkChallenge = (true_evals, answers) => {
  // the true values in CourseTable to compare against
  const truth = true_evals['data']['evaluation_ratings'];

  // mapping from question ID to ratings
  let truthById = {};

  truth.forEach(x => {
    truthById[x['id']] = x['rating'];
  });

  // for each answer, check that it matches our data
  for (const answer of answers) {
    if (
      truthById[answer['courseRatingId']][
        parseInt(answer['courseRatingIndex'])
      ] !== parseInt(answer['answer'])
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Verifies answers to a challenge.
 * @prop req - request object
 * @prop res - return object
 */
export const verifyChallenge = (req, res) => {
  const netid = req.header('x-coursetable-netid'); // user's NetID

  const student = new Student();

  Student.getChallengeStatus(netid, (statusCode, err, data) => {
    if (err) {
      return res.status(statusCode).json({
        error: err,
      });
    }
    const challengeTries = data['challengeTries'];

    Student.incrementChallengeTries(
      challengeTries,
      netid,
      (statusCode, err, data) => {
        if (err) {
          return res.status(statusCode).json({
            error: err,
          });
        }

        let { token, salt, answers } = req.body;

        let secrets; // the decrypted token

        let secretRatingIds; // for retrieving the correct ones from the database

        // list in the format "<question_id>_<rating_index>" to verify
        // the submitted answers match those encoded in the token
        let secretRatings;
        let answerRatings;

        // catch malformed token decryption errors
        try {
          secrets = JSON.parse(decrypt(token, salt));
          secretRatingIds = secrets.map(x => x['courseRatingId']);
          secretRatings = secrets.map(
            x => `${x['courseRatingId']}_${x['courseRatingIndex']}`
          );
        } catch (e) {
          return res.status(406).json({
            error: 'INVALID_TOKEN',
            challengeTries: challengeTries + 1,
          });
        }

        // catch malformed answer JSON errors
        try {
          answers = JSON.parse(answers);
          answerRatings = answers.map(
            x => `${x['courseRatingId']}_${x['courseRatingIndex']}`
          );
        } catch (e) {
          return res.status(406).json({
            error: 'MALFORMED_ANSWERS',
            challengeTries: challengeTries + 1,
          });
        }

        // make sure the provided ratings IDs and indices match those we have
        if (secretRatings.sort().join(',') !== answerRatings.sort().join(',')) {
          return res.status(406).json({
            error: 'INVALID_TOKEN',
            challengeTries: challengeTries + 1,
          });
        }

        query({
          query: verifyEvalsQuery,
          endpoint: GRAPHQL_ENDPOINT,
          variables: {
            questionIds: secretRatingIds,
          },
        })
          .then(true_evals => {
            // if answers are incorrect, respond with error
            if (!checkChallenge(true_evals, answers)) {
              return res.status(200).json({
                body: 'INCORRECT',
                challengeTries: challengeTries + 1,
              });
            }

            // otherwise, enable evaluations
            Student.enableEvaluations(netid, (statusCode, err, data) => {
              if (err) {
                return res.status(statusCode).json({
                  error: err,
                  challengeTries: challengeTries + 1,
                });
              }

              return res.json({
                body: 'CORRECT',
                challengeTries: challengeTries + 1,
              });
            });
          })
          .catch(err => {
            return res.status(500).json({
              error: err,
              challengeTries: challengeTries + 1,
            });
          });
      }
    );
  });
};
