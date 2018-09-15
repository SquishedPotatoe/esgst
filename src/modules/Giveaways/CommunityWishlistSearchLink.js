import Module from '../../class/Module';

class GiveawaysCommunityWishlistSearchLink extends Module {
info = ({
    description: `
      <ul>
        <li>Turns the numbers in the "Giveaways" column of any <a href="https://www.steamgifts.com/giveaways/wishlist">community wishlist</a> page into links that allow you to search for all of the active giveaways for the game (that are visible to you).</li>
      </ul>
    `,
    id: `cwsl`,
    load: this.cwsl,
    name: `Community Wishlist Search Link`,
    sg: true,
    type: `giveaways`
  });

  cwsl() {
    if (this.esgst.wishlistPath) {
      this.esgst.gameFeatures.push(cwsl_getGames);
    }
  }

  cwsl_getGames(games, main) {
    if (!main) {
      return;
    }
    for (const game of games.all) {
      let giveawayCount = game.heading.parentElement.nextElementSibling.nextElementSibling;
      this.esgst.modules.common.createElements(giveawayCount, `inner`, [{
        attributes: {
          class: `table__column__secondary-link`,
          href: `/giveaways/search?${game.type.slice(0, -1)}=${game.id}`
        },
        type: `a`,
        children: [...(Array.from(giveawayCount.childNodes).map(x => {
          return {
            context: x
          };
        }))]
      }]);
    }
  }
}

export default GiveawaysCommunityWishlistSearchLink;