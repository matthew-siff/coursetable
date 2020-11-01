import React, { useState, useEffect, useMemo } from 'react';

import { Row, Badge, OverlayTrigger, Popover, Tooltip } from 'react-bootstrap';

import {
  ratingColormap,
  workloadColormap,
  skillsAreasColors,
} from '../queries/Constants.js';

import chroma from 'chroma-js';

import WorksheetToggleButton from './WorksheetToggleButton';
import CourseConflictIcon from './CourseConflictIcon';
import { useWindowDimensions } from './WindowDimensionsProvider';
import { useUser } from '../user';
import { fbFriendsAlsoTaking, flatten } from '../utilities';
import { IoMdSunny } from 'react-icons/io';
import { FcCloseUpMode } from 'react-icons/fc';
import { FaCanadianMapleLeaf } from 'react-icons/fa';

import Styles from './SearchResultsItem.module.css';

/**
 * Renders a list item for a search result and expanded worksheet list item
 * @prop course - listing data for the current course
 * @prop showModal - function that shows the course modal for this listing
 * @prop multiSeasons - boolean | are we displaying courses across multiple seasons
 * @prop isLast - boolean | is this the last course of the search results?
 * @prop hasSeason - function to pass to bookmark button
 * @prop COL_SPACING - dictionary with widths of each column
 * @prop TITLE_WIDTH - integer that holds width of title
 * @prop isScrolling - boolean | is the user scrolling? if so, hide bookmark and conflict icon
 */

const SearchResultsItem = ({
  unflat_course,
  showModal,
  multiSeasons,
  isLast,
  hasSeason = null,
  COL_SPACING,
  TITLE_WIDTH,
  isScrolling,
}) => {
  const course = useMemo(() => {
    return flatten(unflat_course);
  }, [unflat_course]);

  // Variable used in list keys
  let key = 1;
  // Has the component been mounted?
  const [mounted, setMounted] = useState(false);
  // Fetch width of window
  const { width } = useWindowDimensions();
  // Fetch user context data
  const { user } = useUser();
  // Fetch list of FB Friends that are also shopping this class
  let also_taking = useMemo(() => {
    return user.fbLogin && user.fbWorksheets
      ? fbFriendsAlsoTaking(
          course.season_code,
          course.crn,
          user.fbWorksheets.worksheets,
          user.fbWorksheets.friendInfo
        )
      : [];
  }, [user.fbLogin, user.fbWorksheets, course]);

  // Set mounted on mount
  useEffect(() => {
    if (!mounted) setMounted(true);
  }, [mounted]);

  // Season code for this listing
  const season_code = course.season_code;
  const season = season_code[5];
  const year = season_code.substr(2, 2);
  // Size of season icons
  const icon_size = 10;
  const seasons = ['spring', 'summer', 'fall'];
  // Determine the icon for this season
  const icon = useMemo(() => {
    return season === '1' ? (
      <FcCloseUpMode className="my-auto" size={icon_size} />
    ) : season === '2' ? (
      <IoMdSunny color="#ffaa00" className="my-auto" size={icon_size} />
    ) : (
      <FaCanadianMapleLeaf className="my-auto" size={icon_size} />
    );
  }, [season]);

  // Tooltip for hovering over season
  const season_tooltip = (props) => (
    <Tooltip id="button-tooltip" {...props}>
      <small>
        {seasons[season - 1].charAt(0).toUpperCase() +
          seasons[season - 1].slice(1) +
          ' ' +
          season_code.substr(0, 4)}
      </small>
    </Tooltip>
  );

  // Render popover that contains title, description, and requirements when hovering over course name
  const renderTitlePopover = (props) => {
    return (
      <Popover {...props} id="title_popover">
        <Popover.Title>
          <strong>{course.title}</strong>
        </Popover.Title>
        <Popover.Content>
          {course.description
            ? course.description.length <= 500
              ? course.description
              : course.description.slice(0, 500) + '...'
            : 'no description'}
          <br />
          <div className="text-danger">
            {course.requirements &&
              (course.requirements.length <= 250
                ? course.requirements
                : course.requirements.slice(0, 250) + '...')}
          </div>
        </Popover.Content>
      </Popover>
    );
  };

  // Render tooltip with names of FB friends also shopping
  const renderFBFriendsTooltip = (props) =>
    also_taking.length > 0 ? (
      <Tooltip id="button-tooltip" {...props}>
        {also_taking.join(' • ')}
      </Tooltip>
    ) : (
      <div />
    );

  const code_style = {
    width: `${COL_SPACING.CODE_WIDTH}px`,
    paddingLeft: '15px',
  };
  const title_style = { width: `${TITLE_WIDTH}px` };
  const rate_style = {
    whiteSpace: 'nowrap',
    width: `${COL_SPACING.RATE_WIDTH}px`,
  };
  const prof_style = { width: `${COL_SPACING.PROF_WIDTH}px` };
  const meet_style = { width: `${COL_SPACING.MEET_WIDTH}px` };
  const loc_style = { width: `${COL_SPACING.LOC_WIDTH}px` };
  const num_style = { width: `${COL_SPACING.NUM_WIDTH}px` };
  const sa_style = { width: `${COL_SPACING.SA_WIDTH}px` };

  return (
    <Row
      className={
        'mx-auto pl-4 pr-2 py-0 justify-content-between ' +
        Styles.search_result_item +
        ' ' +
        (isLast ? Styles.last_search_result_item : '')
      }
      onClick={() => {
        showModal(course);
      }}
      tabIndex="0"
    >
      <div
        style={code_style}
        className={Styles.ellipsis_text + ' font-weight-bold'}
      >
        {course.course_code}
        <span className="text-muted">
          {course.section
            ? ' ' + (course.section.length > 1 ? '' : '0') + course.section
            : ''}
        </span>
      </div>
      <OverlayTrigger placement="right" overlay={renderTitlePopover}>
        {/* Course Title, Code, and Skills/Area column */}
        <div style={title_style}>
          {/* Course Title */}
          <div className={Styles.ellipsis_text}>{course.title}</div>
          <Row className="m-auto">
            {/* Season Code */}
            {multiSeasons && (
              <OverlayTrigger
                placement="top"
                delay={{ show: 500, hide: 250 }}
                overlay={season_tooltip}
              >
                <div className={Styles.skills_areas}>
                  <Badge
                    variant="secondary"
                    className={
                      Styles.tag + ' ' + Styles[seasons[parseInt(season) - 1]]
                    }
                    key={key++}
                  >
                    <div style={{ display: 'inline-block' }}>{icon}</div>
                    &nbsp;{"'" + year}
                  </Badge>
                </div>
              </OverlayTrigger>
            )}
            {/* Course Extra Info */}
            {/* {course.extra_info !== 'ACTIVE' && (
              <div className={Styles.extra_info + ' ml-1'}>CANCELLED</div>
            )} */}
          </Row>
        </div>
      </OverlayTrigger>
      {/* Enrollment */}
      <div style={num_style} className="d-flex">
        <span className="m-auto">
          {course.enrolled ? course.enrolled : 'n/a'}
        </span>
      </div>
      {/* # FB Friends also shopping */}
      <div style={num_style} className="d-flex">
        <OverlayTrigger
          placement="top"
          delay={{ show: 100, hide: 100 }}
          overlay={renderFBFriendsTooltip}
        >
          <span className={'m-auto'}>
            {also_taking.length > 0 ? also_taking.length : ''}
          </span>
        </OverlayTrigger>
      </div>
      {/* Class Rating */}
      <div style={rate_style} className="d-flex">
        <div
          // Only show eval data when user is signed in
          style={{
            color: course.average_rating
              ? ratingColormap(course.average_rating).darken(3).css()
              : '#b5b5b5',
            backgroundColor: course.average_rating
              ? chroma(ratingColormap(course.average_rating))
              : '#ebebeb',
          }}
          className={Styles.rating_cell + ' m-auto'}
        >
          {course.average_rating ? course.average_rating.toFixed(1) : 'N/A'}
        </div>
      </div>
      {/* Professor Rating */}
      <div style={rate_style} className="d-flex">
        <div
          // Only show eval data when user is signed in
          style={{
            color: course.average_professor
              ? ratingColormap(course.average_professor).darken(3).css()
              : '#b5b5b5',
            backgroundColor: course.average_professor
              ? chroma(ratingColormap(course.average_professor))
              : '#ebebeb',
          }}
          className={Styles.rating_cell + ' m-auto'}
        >
          {course.average_professor
            ? course.average_professor.toFixed(1)
            : 'N/A'}
        </div>
      </div>
      {/* Workload Rating */}
      <div style={rate_style} className="d-flex">
        <div
          // Only show eval data when user is signed in
          style={{
            color: course.average_workload
              ? workloadColormap(course.average_workload).darken(2).css()
              : '#b5b5b5',
            backgroundColor: course.average_workload
              ? chroma(workloadColormap(course.average_workload))
              : '#ebebeb',
          }}
          className={Styles.rating_cell + ' m-auto'}
        >
          {course.average_workload ? course.average_workload.toFixed(1) : 'N/A'}
        </div>
      </div>
      {/* Course Professors */}
      {width > COL_SPACING.PROF_CUT && (
        <div style={prof_style} className={Styles.ellipsis_text}>
          {course.professor_names.length === 0
            ? 'TBA'
            : course.professor_names.join(' • ')}
        </div>
      )}
      {/* Course Meets */}
      {width > COL_SPACING.MEET_CUT && (
        <div style={meet_style}>
          <div className={Styles.course_time}>{course.times_summary}</div>
        </div>
      )}
      {/* Course Location */}
      {width > COL_SPACING.LOC_CUT && (
        <div style={loc_style}>
          <div className={Styles.ellipsis_text}>{course.locations_summary}</div>
        </div>
      )}
      {/* Skills and Areas */}
      {width > COL_SPACING.SA_CUT && (
        <div style={sa_style} className="d-flex pr-2">
          <span className={Styles.skills_areas + ' '}>
            {course.skills.map((skill) => (
              <Badge
                variant="secondary"
                className={Styles.tag + ' my-auto'}
                key={key++}
                style={{
                  color: skillsAreasColors[skill],
                  backgroundColor: chroma(skillsAreasColors[skill])
                    .alpha(0.16)
                    .css(),
                }}
              >
                {skill}
              </Badge>
            ))}
            {course.areas.map((area) => (
              <Badge
                variant="secondary"
                className={Styles.tag + ' my-auto'}
                key={key++}
                style={{
                  color: skillsAreasColors[area],
                  backgroundColor: chroma(skillsAreasColors[area])
                    .alpha(0.16)
                    .css(),
                }}
              >
                {area}
              </Badge>
            ))}
          </span>
        </div>
      )}
      {/* Bookmark button */}
      <div className={Styles.worksheet_btn}>
        <WorksheetToggleButton
          worksheetView={hasSeason != null}
          crn={course.crn}
          season_code={course.season_code}
          modal={false}
          hasSeason={hasSeason}
        />
      </div>
      {/* Render conflict icon only when component has been mounted */}
      {mounted && !hasSeason && !isScrolling && (
        <div className={Styles.conflict_error}>
          <CourseConflictIcon course={course} />
        </div>
      )}
    </Row>
  );
};

const SearchResultsItemMemo = React.memo(SearchResultsItem);
// SearchResultsItemMemo.whyDidYouRender = true;
export default SearchResultsItemMemo;
