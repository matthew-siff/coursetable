import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Row, Tabs } from 'react-bootstrap';
import styled from 'styled-components';
import natural from 'natural';

import styles from './EvaluationResponses.module.css';
import { TextComponent } from './StyledComponents';
import { evalsColormap } from '../queries/Constants';

// Set up parameters for natural
const language = 'EN';
const defaultCategory = 'N';
const defaultCategoryCapitalized = 'NNP';
const lexicon = new natural.Lexicon(
  language,
  defaultCategory,
  defaultCategoryCapitalized
);
const ruleSet = new natural.RuleSet('EN');
const tagger = new natural.BrillPOSTagger(lexicon, ruleSet);

// Natural's tokenizer (same as split in javascript)
const tokenizer = new natural.WordTokenizer();

// Natural's sentiment analysis
const Analyzer = natural.SentimentAnalyzer;
const stemmer = natural.PorterStemmer;
const analyzer = new Analyzer('English', stemmer, 'senticon');

// Tabs of evaluation comments in modal
const StyledTabs = styled(Tabs)`
  background-color: ${({ theme }) => theme.surface[0]};
  font-weight: 500;
  position: sticky;
  top: -1rem;
  .active {
    background-color: ${({ theme }) => `${theme.surface[0]} !important`};
    color: #468ff2 !important;
    border-bottom: none;
  }
  .nav-item {
    color: ${({ theme }) => theme.text[0]};
  }
  .nav-item:hover {
    background-color: ${({ theme }) => theme.banner};
    color: ${({ theme }) => theme.text[0]};
  }
`;

// Row for each comment
const StyledCommentRow = styled(Row)`
  font-size: 14px;
  font-weight: 450;
  border-bottom: 1px solid ${({ theme }) => theme.multivalue};
`;

// Bubble to choose sort order
const StyledSortOption = styled.span`
  padding: 3px 5px;
  background-color: ${({ theme, active }) =>
    active ? 'rgba(92, 168, 250,0.5)' : theme.border};
  color: ${({ theme, active }) => (active ? theme.text[0] : theme.text[2])};
  font-weight: 500;
  &:hover {
    background-color: ${({ theme, active }) =>
      active ? 'rgba(92, 168, 250,0.5)' : theme.multivalue};
    cursor: pointer;
  }
`;

/**
 * Displays Evaluation Comments
 * @prop crn - integer that holds current listing's crn
 * @prop info - dictionary that holds the eval data for each question
 */

const EvaluationResponses = ({ crn, info }) => {
  // Keep track of user sort, search, and panel selections
  const [sortOrder, setSortOrder] = useState('original');
  const [curPanel, setCurPanel] = useState('recommended');
  const [keyword, setKeyword] = useState('');

  // Keep track of sorted/filtered/suggested data
  const [data, setData] = useState([]);
  const [dataDefault, setDataDefault] = useState([]);
  const [dataDefault2, setDataDefault2] = useState([]);
  const [dataChange, setDataChange] = useState([]);

  // Function to sort frequency of adjectives in each evaluation
  const sortByFrequency = (array) => {
    const frequency = {};
    array.forEach((value) => {
      frequency[value] = 0;
    });
    const uniques = array.filter((value) => {
      return ++frequency[value] === 1;
    });
    return uniques.sort((a, b) => {
      return frequency[b] - frequency[a];
    });
  };

  // Create the lists of relevant comments for the each panel
  const [
    summarizeComments,
    recommendComments,
    skillsComments,
    strengthsComments,
  ] = useMemo(() => {
    const summarizeList = [];
    const recommendList = [];
    const skillsList = [];
    const strengthsList = [];
    info.forEach((section) => {
      const crn_code = section.crn;
      // Only fetch comments for this section
      if (crn_code !== crn) return;
      const { nodes } = section.course.evaluation_narratives_aggregate;
      // Return if no comments
      if (!nodes.length) return;
      // Add comments to relevant list
      nodes.forEach((node) => {
        if (node.evaluation_question.question_text.includes('summarize')) {
          summarizeList.push(node.comment);
        }
        if (node.evaluation_question.question_text.includes('recommend')) {
          recommendList.push(node.comment);
        }
        if (node.evaluation_question.question_text.includes('skills')) {
          skillsList.push(node.comment);
        }
        if (node.evaluation_question.question_text.includes('strengths')) {
          strengthsList.push(node.comment);
        }
      });
    });
    // Save comments
    setData(recommendList);
    setDataDefault(recommendList);
    setDataDefault2(recommendList);
    setDataChange(recommendList);
    return [summarizeList, recommendList, skillsList, strengthsList];
  }, [crn, info]);

  // Generate HTML to display all the evaluations from data
  const [evals] = useMemo(() => {
    const temp_summary = data.map((response) => {
      return (
        <StyledCommentRow key={response} className="m-auto p-2">
          <TextComponent type={1}>{response}</TextComponent>
        </StyledCommentRow>
      );
    });
    return [temp_summary];
  }, [data]);

  // SORT -- Hook to determine which evaluations to show based on sort
  useEffect(() => {
    if (keyword === '') {
      if (sortOrder === 'original') setData(dataDefault2);
      if (sortOrder === 'length')
        setData(
          [...dataDefault2].sort((a, b) => {
            return b.length - a.length;
          })
        );
    } else {
      if (sortOrder === 'original') setData(dataChange);
      if (sortOrder === 'length')
        setData(
          [...dataChange].sort((a, b) => {
            return b.length - a.length;
          })
        );
    }
  }, [dataChange, dataDefault2, keyword, sortOrder]);

  // SEARCH -- Hook to filter evaluations based on search
  useEffect(() => {
    const updateKeyword = (word) => {
      const filtered = dataDefault.filter((x) => {
        return x.toLowerCase().includes(word.toLowerCase());
      });
      setData(filtered);
      setDataChange(filtered);
    };
    updateKeyword(keyword);
  }, [dataDefault, keyword]);

  // SUGGESTIONS -- Hook to filter evaluations based on search
  const [suggestions] = useMemo(() => {
    const adjectives = [];
    const verbs = [];
    let popularWords = [];
    const getEvals = () => {
      // Get every suggestion from evaluations in the current panel selection
      for (let i = 0; i < dataDefault2.length; i++) {
        const sentence = tagger.tag(tokenizer.tokenize(dataDefault2[i]));
        for (let j = 0; j < sentence.taggedWords.length; j++) {
          if (sentence.taggedWords[j].tag === 'JJ') {
            adjectives.push(sentence.taggedWords[j].token);
          }
          // include the verb base form, present tense, and past tense
          if (
            sentence.taggedWords[j].tag === 'VB' ||
            sentence.taggedWords[j].tag === 'VBP' ||
            sentence.taggedWords[j].tag === 'VBD'
          ) {
            verbs.push(sentence.taggedWords[j].token);
          }
        }
      }
    };
    getEvals();
    if (curPanel === 'knowledge/skills') {
      popularWords = sortByFrequency(verbs).slice(0, 15);
    } else {
      popularWords = sortByFrequency(adjectives).slice(0, 15);
    }
    return [popularWords];
  }, [curPanel, dataDefault2]);

  return (
    <div>
      <Row className={`${styles.sort_by} mx-auto mb-2 justify-content-center`}>
        <span className="font-weight-bold my-auto mr-2">Sort by:</span>
        <div className={styles.sort_options}>
          <StyledSortOption
            active={sortOrder === 'original'}
            onClick={() => setSortOrder('original')}
          >
            original
          </StyledSortOption>
          <StyledSortOption
            active={sortOrder === 'length'}
            onClick={() => setSortOrder('length')}
          >
            length
          </StyledSortOption>
          <StyledSortOption
            active={sortOrder === 'positive'}
            onClick={() => setSortOrder('positive')}
          >
            positive
          </StyledSortOption>
          <StyledSortOption
            active={sortOrder === 'negative'}
            onClick={() => setSortOrder('negative')}
          >
            negative
          </StyledSortOption>
        </div>
      </Row>
      <div className="input-group">
        <input
          type="text"
          className="form-control shadow-none"
          width="100%"
          autoComplete="off"
          placeholder="Search for..."
          name="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button
          type="button"
          className="btn bg-transparent shadow-none"
          style={{ marginLeft: '-40px', zIndex: '100' }}
          onClick={() => setKeyword('')}
        >
          X
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-evenly',
          overflow: 'hidden',
          maxHeight: '3.6em',
          lineHeight: '1.8em',
          marginBottom: '2px',
        }}
      >
        {suggestions?.map((x) => (
          <div
            key={x}
            style={{
              color: evalsColormap(analyzer.getSentiment([x]))
                .darken()
                .saturate(),
              marginLeft: '5px',
              marginRight: '5px',
            }}
            onClick={() => setKeyword(x)}
          >
            {x}
          </div>
        ))}
      </div>
      <StyledTabs
        variant="tabs"
        transition={false}
        onSelect={(k) => {
          setKeyword('');
          setCurPanel(k);
          if (k === 'recommended') {
            setDataDefault(recommendComments);
            setDataDefault2(recommendComments);
          }
          if (k === 'knowledge/skills') {
            setDataDefault(skillsComments);
            setDataDefault2(skillsComments);
          }
          if (k === 'strengths/weaknesses') {
            setDataDefault(strengthsComments);
            setDataDefault2(strengthsComments);
          }
          if (k === 'summary') {
            setDataDefault(summarizeComments);
            setDataDefault2(summarizeComments);
          }
        }}
      >
        {/* Recommend Question */}
        <Tab eventKey="recommended" title="Recommend?">
          {evals.length !== 0 ? (
            <div>
              <Row className={`${styles.question_header} m-auto pt-2`}>
                <TextComponent type={0}>
                  Would you recommend this course to another student? Please
                  explain.
                </TextComponent>
              </Row>
              {evals}
            </div>
          ) : (
            'No results'
          )}
        </Tab>
        {/* Knowledge/Skills Question */}
        <Tab eventKey="knowledge/skills" title="Skills">
          {evals.length !== 0 ? (
            <div>
              <Row className={`${styles.question_header} m-auto pt-2`}>
                <TextComponent type={0}>
                  What knowledge, skills, and insights did you develop by taking
                  this course?
                </TextComponent>
              </Row>
              {evals}
            </div>
          ) : (
            'No results'
          )}
        </Tab>
        {/* Strengths/Weaknesses Question */}
        <Tab eventKey="strengths/weaknesses" title="Strengths/Weaknesses">
          {evals.length !== 0 ? (
            <div>
              <Row className={`${styles.question_header} m-auto pt-2`}>
                <TextComponent type={0}>
                  What are the strengths and weaknesses of this course and how
                  could it be improved?
                </TextComponent>
              </Row>
              {evals}
            </div>
          ) : (
            'No results'
          )}
        </Tab>
        {/* Summarize Question */}
        {!recommendComments && !skillsComments && !strengthsComments && (
          <Tab eventKey="summary" title="Summary">
            {evals.length !== 0 ? (
              <div>
                <Row className={`${styles.question_header} m-auto pt-2`}>
                  <TextComponent type={0}>
                    How would you summarize this course? Would you recommend it
                    to another student? Why or why not?
                  </TextComponent>
                </Row>
                {evals}
              </div>
            ) : (
              'No results'
            )}
          </Tab>
        )}
      </StyledTabs>
    </div>
  );
};

export default EvaluationResponses;
