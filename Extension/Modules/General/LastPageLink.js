_MODULES.push({
    description: `
      <ul>
        <li>Adds a "Last Page" link to the pagination navigation of some pages that do not have it. For example: discussion pages with 100+ pages, user pages, group pages with 100+ pages, etc...</li>
      </ul>
    `,
    id: `lpl`,
    load: lpl,
    name: `Last Page Link`,
    sg: true,
    type: `general`
  });

  function lpl() {
    if (!esgst.paginationNavigation) return;
    if (esgst.discussionPath) {
      lpl_addDiscussionLink();
    } else if (esgst.userPath) {
      lpl_addUserLink();
    } else if (esgst.groupPath) {
      lpl_addGroupLink();
    }
  }

  function lpl_getLastPage(context, main, discussion, user, userWon, group, groupUsers, groupWishlist) {
    let element, first, lastPage, pagination, paginationNavigation, paginationResults, second, third;
    pagination = context.getElementsByClassName(`pagination`)[0];
    paginationResults = context.getElementsByClassName(`pagination__results`)[0];
    paginationNavigation = context.getElementsByClassName(`pagination__navigation`)[0];
    if (paginationNavigation) {
      element = paginationNavigation.lastElementChild;
      if (element.textContent.match(/Last/)) {
        lastPage = parseInt(element.getAttribute(`data-page-number`));
      } else if ((main && esgst.discussionPath) || discussion) {
        if (pagination) {
          lastPage = Math.ceil(parseInt(pagination.firstElementChild.lastElementChild.textContent.replace(/,/g, ``)) / 25);
        } else {
          lastPage = 999999999;
        }
      } else if ((main && esgst.userPath) || user) {
        if ((main && location.pathname.match(/\/giveaways\/won/)) || userWon) {
          lastPage = Math.ceil(parseInt(context.querySelector(`.featured__table__row__right a[href*="/giveaways/won"]`).textContent.replace(/,/g, ``)) / 25);
        } else {
          lastPage = Math.ceil(parseInt(context.getElementsByClassName(`sidebar__navigation__item__count`)[0].textContent.replace(/,/g, ``)) / 25);
        }
      } else if ((main && esgst.groupPath) || group) {
        if ((main && location.pathname.match(/\/users/)) || groupUsers) {
          lastPage = Math.ceil(parseInt(context.getElementsByClassName(`sidebar__navigation__item__count`)[1].textContent.replace(/,/g, ``)) / 25);
        } else if ((main && esgst.groupWishlistPath) || groupWishlist) {
          lastPage = 999999999;
        } else {
          lastPage = Math.ceil(parseInt(context.getElementsByClassName(`sidebar__navigation__item__count`)[0].textContent.replace(/,/g, ``)) / 25);
        }
      } else {
        lastPage = 999999999;
      }
    } else {
      lastPage = 999999999;
    }
    if (lastPage === 999999999 && paginationResults) {
      first = paginationResults.firstElementChild;
      if (first) {
        second = first.nextElementSibling;
        if (second) {
          third = second.nextElementSibling;
          if (third && !third.textContent.match(/Giveaway\sFilters/)) {
            lastPage = Math.ceil(parseInt(third.textContent.replace(/,/g, ``)) / parseInt(second.textContent.replace(/,/g, ``)));
          }
        }
      }
    }
    return lastPage;
  }

  function lpl_addDiscussionLink() {
    let lastLink, url;
    url = `${location.pathname.replace(`/search`, ``)}/search?page=${esgst.lastPage}`;
    esgst.lastPageLink = [{
      attributes: {
        [`data-page-number`]: esgst.lastPage,
        href: url
      },
      type: `a`,
      children: [{
        text: `Last`,
        type: `span`
      }, {
        attributes: {
          class: `fa fa-angle-double-right`
        },
        type: `i`
      }]
    }];
    lastLink = esgst.paginationNavigation.lastElementChild;
    if (!lastLink.classList.contains(`is-selected`) && !lastLink.textContent.match(/Last/)) {
      createElements(esgst.paginationNavigation, `beforeEnd`, esgst.lastPageLink);
    }
  }

  function lpl_addUserLink() {
    let lastLink, url, username;
    username = location.pathname.match(/^\/user\/(.+?)(\/.*?)?$/)[1];
    if (location.pathname.match(/\/giveaways\/won/)) {
      url = `/user/${username}/giveaways/won/search?page=${esgst.lastPage}`;
    } else {
      url = `/user/${username}/search?page=${esgst.lastPage}`;
    }
    esgst.lastPageLink = [{
      attributes: {
        [`data-page-number`]: esgst.lastPage,
        href: url
      },
      type: `a`,
      children: [{
        text: `Last`,
        type: `span`
      }, {
        attributes: {
          class: `fa fa-angle-double-right`
        },
        type: `i`
      }]
    }];
    lastLink = esgst.paginationNavigation.lastElementChild;
    if (esgst.currentPage !== esgst.lastPage && !lastLink.classList.contains(`is-selected`) && !lastLink.textContent.match(/Last/)) {
      createElements(esgst.paginationNavigation, `beforeEnd`, esgst.lastPageLink);
    }
  }

  function lpl_addGroupLink() {
    let group, lastLink, url;
    group = location.pathname.match(/^\/group\/(.+?\/.+?)(\/.*?)?$/)[1];
    if (location.pathname.match(/\/users/)) {
      url = `/group/${group}/users/search?page=${esgst.lastPage}`;
    } else if (esgst.groupWishlistPath) {
      url = `/group/${group}/wishlist/search?page=${esgst.lastPage}`;
    } else {
      url = `/group/${group}/search?page=${esgst.lastPage}`;
    }
    esgst.lastPageLink = [{
      attributes: {
        [`data-page-number`]: esgst.lastPage,
        href: url
      },
      type: `a`,
      children: [{
        text: `Last`,
        type: `span`
      }, {
        attributes: {
          class: `fa fa-angle-double-right`
        },
        type: `i`
      }]
    }];
    lastLink = esgst.paginationNavigation.lastElementChild;
    if (esgst.currentPage !== esgst.lastPage && !lastLink.classList.contains(`is-selected`) && !lastLink.textContent.match(/Last/)) {
      createElements(esgst.paginationNavigation, `beforeEnd`, esgst.lastPageLink);
    }
  }
