import { Component, h } from "preact";

import { BigBoardCore } from './includes/big-board-core.js';
import { GetCaughtUp } from './includes/get-caught-up.js';
import { StateResults } from './includes/state-results.js';

import Scrapple from "@twilburn/scrapple";

var metaData = {
  senate: {
    json: "senate-national.json",
    title: "Senate"
  },
  house: {
    json: "house-national.json",
    title: "House"
  },
  ballot: {
    json: "ballot-measures-national.json",
    title: "Ballot"
  }
};

export default class App extends Component {
  constructor() {
    super();
    this.state = {
      route: "renderGetCaughtUp",
      params: {}
    };

    this.router = new Scrapple();
    this.addRoute("/boards/:type", "renderBoards");
    this.addRoute("/get-caught-up", "renderGetCaughtUp");
    this.addRoute("/states/:state", "renderState");
  }

  addRoute(path, route) {
    this.router.add(path, ({ params }) => {
      this.setState({ route, params });
    });
  }

  renderBoards() {
    let currentBoard = this.state.params.type;
    return (
      <div class="board big-board">
        <BigBoardCore
          json={metaData[currentBoard].json}
          title={metaData[currentBoard].title}
        />
      </div>
    );
  }

  renderState() {
    let currentState = this.state.params.state;
    return <div id="state-results">
            <StateResults state={currentState} activeView="key"/>
          </div>
  }

  renderGetCaughtUp() {
    return <div class="get-caught-up-wrapper">
            <GetCaughtUp />
          </div>
  }

  render(props, state) {
    return this[state.route]();
  }
}
