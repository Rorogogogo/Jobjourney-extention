import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/example/App';
import inlineCss from '../../../dist/example/index.css?inline';

initAppWithShadow({ id: 'CEB-extension-example', app: <App />, inlineCss });
