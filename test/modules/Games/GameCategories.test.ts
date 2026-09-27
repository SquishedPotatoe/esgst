import { expect } from 'chai';
import { getSteamStoreResponseData } from '../../../src/modules/Games/GameCategories';

describe('Game Categories Steam response lookup', () => {
	it('accepts an appdetails result keyed by a DLC ID when its inner app ID matches', () => {
		const data = { steam_appid: 973580, release_date: { date: 'Nov 22, 2019' } };
		expect(getSteamStoreResponseData({ 1674637: { success: true, data } }, 973580, 'apps'))
			.to.equal(data);
	});

	it('prefers the requested key and rejects unrelated or ambiguous fallback results', () => {
		const direct = { steam_appid: 973580 };
		const other = { steam_appid: 123 };
		expect(getSteamStoreResponseData({ 973580: { data: direct }, 123: { data: other } }, 973580, 'apps'))
			.to.equal(direct);
		expect(getSteamStoreResponseData({ 123: { data: other } }, 973580, 'apps')).to.be.null;
		expect(
			getSteamStoreResponseData({ 1: { data: direct }, 2: { data: direct } }, 973580, 'apps')
		).to.be.null;
		expect(getSteamStoreResponseData({ 1674637: { data: direct } }, 973580, 'subs')).to.be.null;
	});
});
