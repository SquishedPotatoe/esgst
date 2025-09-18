(function () {
    const currentScript = document.currentScript;
    let raw = currentScript?.dataset.settings || '{}';
    let settings;
    try {
        settings = JSON.parse(raw);
    } catch {
        settings = {};
    }

    const dateFormat = settings.cgc_dateFormat || 'yy-mm-dd';
    const firstDay = settings.cgc_index_0 ?? 0;
    const timeFormat = settings.cgc_timeFormat || 'HH:mm';

    function esgst_cgc() {
        const actualStartInput = document.querySelector('input[name=start_time]');
        if (!actualStartInput) return;

        actualStartInput.setAttribute('type', 'hidden');

        const startInput = document.createElement('input');
        startInput.className = 'form__input-small';
        startInput.setAttribute('type', 'text');
        actualStartInput.parentElement.insertBefore(startInput, actualStartInput);

        const actualEndInput = document.querySelector('input[name=end_time]');
        if (!actualEndInput) return;

        actualEndInput.setAttribute('type', 'hidden');

        const endInput = document.createElement('input');
        endInput.className = 'form__input-small';
        endInput.setAttribute('type', 'text');
        actualEndInput.parentElement.insertBefore(endInput, actualEndInput);

        if (window.jQuery && $.fn.datetimepicker) {
            function highlightRange(date) {
                const start = $("input[name=start_time]").datetimepicker("getDate");
                const end = $("input[name=end_time]").datetimepicker("getDate");
                if (start && end) {
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);
                    return [true, date.getTime() >= start.getTime() && date.getTime() <= end.getTime() ? "datepicker-highlight-range" : ""];
                }
                return [true, ""];
            }

            function fixStartEnd() {
                let start = $("input[name=start_time]").datetimepicker("getDate");
                let end = $("input[name=end_time]").datetimepicker("getDate");
                if (start && end) {
                    start = new Date(start.getTime() + 3600000);
                    if (start > end) $("input[name=end_time]").datetimepicker("setDate", start);
                }
            }

            function fixEndStart() {
                let start = $("input[name=start_time]").datetimepicker("getDate");
                let end = $("input[name=end_time]").datetimepicker("getDate");
                if (start && end) {
                    end = new Date(end.getTime() - 3600000);
                    if (end < start) $("input[name=start_time]").datetimepicker("setDate", end);
                }
            }

            $(actualStartInput).datetimepicker("destroy");
            $(actualEndInput).datetimepicker("destroy");

            $(startInput).datetimepicker({
                altField: "input[name=start_time]",
                altFieldTimeOnly: false,
                altFormat: "M d, yy",
                altTimeFormat: "h:mm tt",
                beforeShowDay: highlightRange,
                dateFormat,
                firstDay,
                maxDate: new Date(Date.now() + 2592e6 - 36e5),
                maxDateTime: new Date(Date.now() + 2592e6 - 36e5),
                minDate: new Date(),
                minDateTime: new Date(),
                numberOfMonths: 1,
                selectOtherMonths: true,
                showOtherMonths: true,
                timeFormat,
                onSelect: fixStartEnd,
                onClose: fixStartEnd
            });
            if (actualStartInput.value) {
                $(startInput).datetimepicker("setDate", new Date(actualStartInput.value));
            }

            $(endInput).datetimepicker({
                altField: "input[name=end_time]",
                altFieldTimeOnly: false,
                altFormat: "M d, yy",
                altTimeFormat: "h:mm tt",
                beforeShowDay: highlightRange,
                dateFormat,
                firstDay,
                maxDate: new Date(Date.now() + 2592e6),
                maxDateTime: new Date(Date.now() + 2592e6),
                minDate: new Date(Date.now() + 36e5),
                minDateTime: new Date(Date.now() + 36e5),
                numberOfMonths: 1,
                selectOtherMonths: true,
                showOtherMonths: true,
                timeFormat,
                onSelect: fixEndStart,
                onClose: fixEndStart
            });
            if (actualEndInput.value) {
                $(endInput).datetimepicker("setDate", new Date(actualEndInput.value));
            }
        }
    }
    if (document.readyState === "complete") {
        esgst_cgc();
    } else {
        $(window).on("load", function () {
            esgst_cgc();
        });
    }
})();
