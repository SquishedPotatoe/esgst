import Module from '../../class/Module';

class UsersVisibleRealCV extends Module {
info = ({
    description: `
      <ul>
        <li>Displays the real sent/won CV next to the raw value in a user's <a href="https://www.steamgifts.com/user/cg">profile</a> page.</li>
        <li>This also extends to [id=swr], if you have that feature enabled.</li>
        <li>With this feature disabled, you can still view the real CV, as provided by SteamGifts, by hovering over the raw value.</li>
      </ul>
    `,
    id: `vrcv`,
    load: this.vrcv,
    name: `Visible Real CV`,
    sg: true,
    type: `users`
  });

  vrcv() {
    this.esgst.profileFeatures.push(vrcv_add);
  }

  vrcv_add(profile) {
    profile.sentCvContainer.insertAdjacentText(`beforeEnd`, ` / $${profile.realSentCV.toLocaleString(`en`)}`);
    profile.wonCvContainer.insertAdjacentText(`beforeEnd`, ` / $${profile.realWonCV.toLocaleString(`en`)}`);
  }
}

export default UsersVisibleRealCV;