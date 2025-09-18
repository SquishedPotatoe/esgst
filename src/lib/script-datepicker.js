(function () {
  document.addEventListener('setDatepickerDate', (event) => {
    const { target, timestamp } = event.detail;
    if (!target || !timestamp) return;

    const input = document.querySelector(`input[name="${target}"]`);
    if (!input) return;

    const actualInput = input.previousElementSibling?.classList.contains('hasDatepicker')
      ? input.previousElementSibling
      : input;

    const interval = setInterval(() => {
      if (typeof jQuery !== 'undefined' && $(actualInput).datetimepicker) {
        clearInterval(interval);
        $(actualInput).datetimepicker('setDate', new Date(timestamp));
      }
    }, 50);
  });
})();
