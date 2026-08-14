(() => {
    const mouseEnter = (event) => {
        const target = event.target?.closest?.('[data-timestamp]');
        if (!target) return;

        const title = target.getAttribute('title');
        
        if (!title) {
            const timestamp = target.getAttribute('data-esgst-timestamp');
            const tooltipData = {
                rows: [
                    {
                        icon: [{ class: 'fa-clock-o', color: '#84cfda' }],
                        columns: [{ name: timestamp }],
                    },
                ],
            };
            target.setAttribute('data-ui-tooltip', JSON.stringify(tooltipData));
        }
    };

    function initListener() {
        document.removeEventListener('mouseenter', mouseEnter, true);
        document.addEventListener('mouseenter', mouseEnter, true);
    }

    if (document.readyState === 'complete') {
        initListener();
    } else {
        window.addEventListener('load', initListener);
    }
})();
