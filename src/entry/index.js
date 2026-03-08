//import '../dependencies';
import '../main';

window.addEventListener('beforeunload', () => {
  try {
    chrome.runtime.sendMessage({ action: 'flush' });
  } catch (err) {
  }
});
