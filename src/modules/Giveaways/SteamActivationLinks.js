import Module from '../../class/Module';

class GiveawaysSteamActivationLinks extends Module {
info = ({
    description: `
      <ul>
        <li>Adds 2 optional icons (<i class="fa fa-steam"></i> for the Steam client and <i class="fa fa-globe"></i> for the browser) next to each key in the "Key" column of your <a href="https://www.steamgifts.com/giveaways/won">won</a> page that allow you to quickly activate a won game on Steam, either through the client or the browser.</li>
        <li>When you click on the icon, the key is automatically copied to the clipboard.</li>
      </ul>
    `,
    id: `sal`,
    load: this.sal,
    name: `Steam Activation Links`,
    options: {
      title: `Show links to:`,
      values: [`Steam Client`, `Browser`, `Both`]
    },
    sg: true,
    type: `giveaways`
  });

  sal() {
    if (!this.esgst.wonPath) return;
    this.esgst.endlessFeatures.push(sal_addLinks, this.sal_addObservers);
  }

  sal_addObservers(context, main, source, endless) {
    const elements = context.querySelectorAll(`${endless ? `.esgst-es-page-${endless} .view_key_btn, .esgst-es-page-${endless}.view_key_btn` : `.view_key_btn`}`);
    for (const element of elements) {
      this.sal_addObserver(element);
    }
  }

  sal_addObserver(button) {
    let interval = null;
    const context = button.closest(`.table__row-outer-wrap`);
    button.addEventListener(`click`, () => {
      if (interval) {
        return;
      }
      interval = setInterval(() => {
        if (!context.contains(button)) {
          clearInterval(interval);
          interval = null;
          if (this.esgst.sal) {
            const element = context.querySelector(`[data-clipboard-text]`);
            const match = element.getAttribute(`data-clipboard-text`).match(/^[\d\w]{5}(-[\d\w]{5}){2,}$/);
            if (match) {
              this.sal_addLink(element, match[0]);
            }
          }
          if (this.esgst.ef) {
            this.esgst.modules.generalElementFilters.ef_hideElements(context);
          }
        }
      }, 100);
    });
  }

  sal_addLinks(context, main, source, endless) {
    const elements = context.querySelectorAll(`${endless ? `.esgst-es-page-${endless} [data-clipboard-text], .esgst-es-page-${endless}[data-clipboard-text]` : `[data-clipboard-text]`}`);
    for (const element of elements) {
      if (element.parentElement.getElementsByClassName(`esgst-sal`)[0]) {
        continue;
      }
      const match = element.getAttribute(`data-clipboard-text`).match(/^[\d\w]{5}(-[\d\w]{5}){2,}$/);
      if (match) {
        this.sal_addLink(element, match[0]);
      }
    }
  }

  sal_addLink(element, match) {
    let link, textArea;
    if ((element.nextElementSibling && !element.nextElementSibling.classList.contains(`esgst-sal`)) || !element.nextElementSibling) {
      link = this.esgst.modules.common.createElements(element, `afterEnd`, [{
        type: `span`
      }]);
      switch (this.esgst.sal_index) {
        case 0:
          this.esgst.modules.common.createElements(link, `beforeEnd`, [{
            attributes: {
              class: `esgst-sal esgst-clickable`,
              title: this.esgst.modules.common.getFeatureTooltip(`sal`, `Activate on Steam (client)`)
            },
            type: `span`,
            children: [{
              attributes: {
                class: `fa fa-steam`
              },
              type: `i`
            }]
          }]).addEventListener(`click`, () => {
            textArea = this.esgst.modules.common.createElements(document.body, `beforeEnd`, [{
              type: `textarea`
            }]);
            textArea.value = match;
            textArea.select();
            document.execCommand(`copy`);
            textArea.remove();
            location.href = `steam://open/activateproduct`;
          });
          break;
        case 1:
          this.esgst.modules.common.createElements(link, `beforeEnd`, [{
            attributes: {
              class: `esgst-sal esgst-clickable`,
              href: `https://store.steampowered.com/account/registerkey?key=${match}`,
              target: `_blank`,
              title: this.esgst.modules.common.getFeatureTooltip(`sal`, `Activate on Steam (browser)`)
            },
            type: `a`,
            children: [{
              attributes: {
                class: `fa fa-globe`
              },
              type: `i`
            }]
          }]);
          break;
        case 2:
          this.esgst.modules.common.createElements(link, `beforeEnd`, [{
            attributes: {
              class: `esgst-sal esgst-clickable`,
              title: this.esgst.modules.common.getFeatureTooltip(`sal`, `Activate on Steam (client)`)
            },
            type: `span`,
            children: [{
              attributes: {
                class: `fa fa-steam`
              },
              type: `i`
            }]
          }, {
            attributes: {
              class: `esgst-sal esgst-clickable`,
              href: `https://store.steampowered.com/account/registerkey?key=${match}`,
              target: `_blank`,
              title: this.esgst.modules.common.getFeatureTooltip(`sal`, `Activate on Steam (browser)`)
            },
            type: `a`,
            children: [{
              attributes: {
                class: `fa fa-globe`
              },
              type: `i`
            }]
          }]).previousElementSibling.addEventListener(`click`, () => {
            textArea = this.esgst.modules.common.createElements(document.body, `beforeEnd`, [{
              type: `textarea`
            }]);
            textArea.value = match;
            textArea.select();
            document.execCommand(`copy`);
            textArea.remove();
            location.href = `steam://open/activateproduct`;
          });
          break;
      }
    }
  }
}

export default GiveawaysSteamActivationLinks;