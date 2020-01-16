import React from 'react';
import { Provider } from 'react-redux';
import { createBrowserHistory } from 'history';
import { configureStore } from './store/store';
import { clearActionsCache } from './store/actions';
import { createActionSequences } from './store/sequences';
import { createInitialState } from './store/state';

import PageRouter from './components/PageRouter';
import StartWrapper from './components/StartWrapper';
import WarningComponent from './components/WarningComponent';

let constants;
let ComponentComposer;
let PageComposer;
if (process.env.NODE_ENV !== 'production') {
  constants = require('./commons/constants');
  ComponentComposer = require('./components/ComponentComposer/ComponentComposer').default;
  PageComposer = require('./components/PageComposer/PageComposer').default;
}

const initStore = (pages, name, version) => {
  const initialState = createInitialState(pages);
  const history = createBrowserHistory();
  const store = configureStore(initialState, { history }, { name, version });

  if (process.env.NODE_ENV !== 'production') {
    window.__sendFrameworkMessage = (message) => {
      if (message) {
        window.parent.postMessage(message, '*');
      }
    };
    // Listen for changes to the current location.
    history.listen((location) => {
      // location is an object like window.location
      window.__sendFrameworkMessage({
        type: constants.FRAMEWORK_MESSAGE_CHANGE_URL,
        payload: `${location.pathname}${location.search}${location.hash}`,
      });
    });
  }

  return {store, history};
};

class Application extends React.Component {

  componentDidMount () {
    if (process.env.NODE_ENV !== 'production') {
      window.addEventListener("message", this.handleReceiveMessage, false);
    }
  }

  componentWillUnmount () {
    if (process.env.NODE_ENV !== 'production') {
      window.removeEventListener("message", this.handleReceiveMessage);
    }
  }

  handleReceiveMessage = (event) => {
    if (process.env.NODE_ENV !== 'production') {
      const {data: message} = event;
      if (message) {
        const { type } = message;
        if (type === constants.WEBCODESK_MESSAGE_START_LISTENING_TO_FRAMEWORK) {
          window.__webcodeskIsListeningToFramework = true;
          setTimeout(() => {
            window.__sendFrameworkMessage({
              type: constants.FRAMEWORK_MESSAGE_INIT_DEBUG,
              payload: {
                actionSequences: this.actionSequences,
                targetProperties: this.targetProperties,
              },
            });
          }, 0);
        } else if (type === constants.WEBCODESK_MESSAGE_STOP_LISTENING_TO_FRAMEWORK) {
          window.__webcodeskIsListeningToFramework = false;
        }
      }
    }
  };

  render () {
    const { schema, userComponents, userFunctions, name, version } = this.props;
    if (process.env.NODE_ENV !== 'production') {
      const href = window.location.href;
      if (href.indexOf('/webcodesk__component_view') > 0) {
        return (
          <ComponentComposer userComponents={userComponents} />
        );
      } else if(href.indexOf('/webcodesk__page_composer') > 0) {
        return (
          <PageComposer userComponents={userComponents} />
        )
      }
    }
    const { routes, pages, flows } = schema;
    const {store, history } = initStore(pages, name, version);
    if (!store) {
      return (
        <WarningComponent message="Redux store is not initialized." />
      );
    }
    window.__applicationBrowserHistory = history;
    clearActionsCache();
    const { actionSequences, targetProperties } = createActionSequences(flows, userFunctions);
    // store action sequences and components properties in case we have to send them for debug
    this.actionSequences = actionSequences;
    this.targetProperties = targetProperties;
    return (
      <Provider store={store}>
        <StartWrapper
          actionSequences={actionSequences}
          store={store}
        >
          <PageRouter
            history={history}
            routes={routes}
            pages={pages}
            userComponents={userComponents}
            actionSequences={actionSequences}
            targetProperties={targetProperties}
          />
        </StartWrapper>
      </Provider>
    );
  }
}

export default Application;