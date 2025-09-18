(function () {
    function esgst_at_t() {
        $(document).off("mouseenter", "[data-timestamp]");
        $(document).on("mouseenter", "[data-timestamp]", function () {
            var e = $(this).attr("title");
            if (void 0 === e || !1 === e) {
                $(this).attr(
                    "data-ui-tooltip",
                    '{"rows":[{"icon":[{"class":"fa-clock-o","color":"#84cfda"}],"columns":[{"name":"' +
                    $(this).attr("data-esgst-timestamp") +
                    '"}]}]}'
                );
            }
        });
    }

    if (document.readyState === "complete") {
        esgst_at_t();
    } else {
        $(window).on("load", esgst_at_t);
    }
})();
