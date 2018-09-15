import Module from '../../class/Module';

class GeneralElementFilters extends Module {
info = ({
    description: `
      <ul>
        <li>Allows you to hide elements in any page using CSS selectors.</li>
        <li>If you do not know how to use CSS selectors or you are having trouble hiding an element, leave a comment in the ESGST thread with a description/image of the element that you want to hide and I will give you the selector that you have to use.</li>
        <li>Here are some quick examples:</li>
        <ul>
          <li>To hide the "Redeem" button in your <a href="https://www.steamgifts.com/giveaways/won">won</a> page, use: <code>.table__column__key__redeem</code></li>
          <li>To hide the featured giveaway container (the big giveaway) in the main page, use: <code>[this.esgst.giveawaysPath].featured__container</code></li>
          <li>To hide the pinned giveaways (the multiple copy giveaways) in the main page, use: <code>[this.esgst.giveawaysPath].pinned-giveaways__outer-wrap</code></li>
        </ul>
      </ul>
    `,
    inputItems: [
      {
        id: `ef_filters`,
        prefix: `Filters: `,
        tooltip: `Separate each selector by a comma followed by a space, for example: .class_1, .class_2, #id`
      }
    ],
    id: `ef`,
    load: this.ef,
    name: `Element Filters`,
    sg: true,
    st: true,
    type: `general`
  });

  ef() {
    this.ef_hideElements(document);
    this.esgst.endlessFeatures.push(ef_hideElements);
    if (this.esgst.sal || !this.esgst.wonPath) return;
    this.esgst.endlessFeatures.push(sal_addObservers);
  }

  ef_hideElements(context, main, source, endless) {
    if (context === document && main) return;
    this.esgst.ef_filters.split(`, `).forEach(filter => {
      if (!filter) return;
      try {
        const property = filter.match(/\[esgst\.(.+)\]/);
        if (property) {
          if (!this.esgst[property[1]]) return;
          filter = filter.replace(/\[esgst\..+\]/, ``);
        }
        const elements = context.querySelectorAll(`${endless ? `.esgst-es-page-${endless} ${filter}, .esgst-es-page-${endless}${filter}` : `${filter}`}`);
        for (let i = elements.length - 1; i > -1; i--) {
          elements[i].classList.add(`esgst-hidden`);
        }
      } catch (e) { /**/ }
    });
  }
}

export default GeneralElementFilters;