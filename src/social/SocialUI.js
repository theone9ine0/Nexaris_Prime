import { SocialPresence } from './SocialPresence.js';

/**
 * PR52 — friends list, party panel, presence indicators.
 */
export class SocialUI {
  /**
   * @param {HTMLElement | null} container
   * @param {import('./SocialService.js').SocialService} social
   * @param {{
   *   onVisitFriend?: (username: string) => void,
   *   onVisitOwnPlace?: () => void,
   *   onPartyTravel?: () => void,
   * }} [callbacks]
   */
  constructor(container, social, callbacks = {}) {
    this.social = social;
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'social-ui hidden';

    const header = document.createElement('div');
    header.className = 'social-header';
    header.innerHTML = '<strong>Friends & Party</strong>';

    this.localStatusEl = document.createElement('div');
    this.localStatusEl.className = 'social-local-status';
    this.localStatusEl.textContent = 'Online';

    const addRow = document.createElement('div');
    addRow.className = 'social-add-row';
    this.addInput = document.createElement('input');
    this.addInput.type = 'text';
    this.addInput.className = 'social-input';
    this.addInput.placeholder = 'Add friend username…';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'social-btn';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => this._addFriend());
    addRow.append(this.addInput, addBtn);

    this.friendsList = document.createElement('div');
    this.friendsList.className = 'social-friends-list';

    const partyTitle = document.createElement('div');
    partyTitle.className = 'social-party-title';
    partyTitle.textContent = 'Party';

    this.partyInfo = document.createElement('div');
    this.partyInfo.className = 'social-party-info';

    const partyActions = document.createElement('div');
    partyActions.className = 'social-actions';
    this.visitBtn = document.createElement('button');
    this.visitBtn.type = 'button';
    this.visitBtn.className = 'social-btn social-btn-visit';
    this.visitBtn.textContent = 'Visit Friend';
    this.visitBtn.addEventListener('click', () => this._visitSelected());
    this.myPlaceBtn = document.createElement('button');
    this.myPlaceBtn.type = 'button';
    this.myPlaceBtn.className = 'social-btn social-btn-place';
    this.myPlaceBtn.textContent = 'Your Place';
    this.myPlaceBtn.addEventListener('click', () => this.callbacks.onVisitOwnPlace?.());
    this.inviteBtn = document.createElement('button');
    this.inviteBtn.type = 'button';
    this.inviteBtn.className = 'social-btn';
    this.inviteBtn.textContent = 'Invite to Party';
    this.inviteBtn.addEventListener('click', () => {
      if (this._selectedUsername) {
        this.social.party.inviteToParty(this._selectedUsername);
        this.refresh();
      }
    });
    partyActions.append(this.visitBtn, this.myPlaceBtn, this.inviteBtn);

    this.root.append(
      header,
      this.localStatusEl,
      addRow,
      this.friendsList,
      partyTitle,
      this.partyInfo,
      partyActions,
    );
    container?.appendChild(this.root);

    this._unsub = social.onPresenceUpdate(() => this.refresh());
    this.refresh();
  }

  _addFriend() {
    const name = this.addInput.value.trim();
    if (!name) return;
    if (this.social.friends.addFriend(name)) {
      this.addInput.value = '';
      this.refresh();
    }
  }

  _visitSelected() {
    if (!this._selectedUsername) return;
    this.callbacks.onVisitFriend?.(this._selectedUsername);
  }

  refresh() {
    this.localStatusEl.textContent = this.social.presence.getLocalStatusLine();

    this.friendsList.innerHTML = '';
    this._selectedUsername = this.social.getSelectedFriend()?.username ?? null;

    for (const friend of this.social.friends.getFriends()) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'social-friend-row';
      if (friend.username === this._selectedUsername) {
        row.classList.add('selected');
      }

      const dot = document.createElement('span');
      dot.className = `social-status-dot ${friend.online ? 'online' : 'offline'}`;

      const name = document.createElement('span');
      name.className = 'social-friend-name';
      name.textContent = friend.username;

      const status = document.createElement('span');
      status.className = 'social-friend-status';
      status.textContent = SocialPresence.formatFriendStatus(friend);

      row.append(dot, name, status);
      row.addEventListener('click', () => {
        this.social.selectFriend(friend.username);
        this._selectedUsername = friend.username;
        this.refresh();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'social-friend-remove';
      remove.textContent = '×';
      remove.title = 'Remove friend';
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        this.social.friends.removeFriend(friend.username);
        this.refresh();
      });
      row.appendChild(remove);

      this.friendsList.appendChild(row);
    }

    const party = this.social.party.getParty();
    if (party) {
      this.partyInfo.textContent = `Leader: ${party.leader} · ${party.members.length}/4 — ${party.members.join(', ')}`;
      this.visitBtn.disabled = !this._selectedUsername;
    } else {
      this.partyInfo.textContent = 'No active party';
    }
  }

  show() {
    this.root.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.root.classList.add('hidden');
  }

  dispose() {
    this._unsub?.();
    this.root.remove();
  }
}
