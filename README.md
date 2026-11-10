# BP Club

A Brownie Points (BP) leaderboard and power-up shop for the classroom, synced across devices. The teacher signs in to give BP; everyone else can watch the leaderboard live.

## Ranks

| Place | Title |
| --- | --- |
| 1st | King |
| 2nd | Lord |
| 3rd | Knight |
| Everyone else | Subject |

Students on the same BP share a place. You need some BP to hold a title.

## Power-ups

| Power-up | Cost | Effect |
| --- | --- | --- |
| Rage | 8 BP | 2× BP for 14 days. Buying again adds another 14 days. |
| Fireball | 20 BP | Target earns ½ BP for 1 lesson (this lesson or next). |
| Minus Spell | 15 BP | Target loses 8 BP. |
| Wheel of Fortune | 8 BP | Spin for a random prize or penalty. |
| The Eternal Brownie | 40 BP | A brownie baked by the teacher. |

- Rage and Fireball change every BP a student earns while active: the Give BP buttons, the +1 / +5 buttons on the leaderboard, other amounts, and BP won on the wheel. With Rage, +1 adds 2; with Fireball, +1 adds ½.
- Taking BP away is never doubled or halved.
- Rage ends by itself. Fireball ends when you press **End lesson**.
- Active effects show as badges next to each name. The +1 / +5 buttons show what they will really add (for example "+1 =2").
- Brownies owed are listed at the bottom of **Power-ups** until you press **Handed over**.
- Typing a number in the BP box on **Students** sets the total directly and ignores power-ups.

Prices, Rage length, the Minus Spell amount and the wheel slices can be changed in **Settings**.

## Using it

1. Open the site, press **Teacher login** and sign in with the teacher email and password (created in Firebase → Authentication → Users).
2. Add your class in **Students** (one name per line), or press **Load example class** to try it out.
3. **Give BP**: tap students, then tap an amount.
4. **Power-ups**: press **Buy** and pick the buyer (and target).
5. Press **End lesson** at the end of each lesson.
6. **Lock** signs the teacher out and hides all controls.
7. **History** lists everything; **Undo last** (or Ctrl+Z) reverses a mistake.

## Sync

The club is stored online in Firebase (Firestore document `clubs/main`). Any device that opens the site sees the same leaderboard, live. Only the signed-in teacher can change anything; everyone else is read-only.

The database rules are in `firestore.rules`: paste them into Firebase → Firestore Database → Rules and press **Publish**. The first teacher account to save becomes the owner, and only that account can write afterwards.

**Settings → Backup → Download** saves a copy as a file; **Restore** loads it.

## Hosting (GitHub Pages)

**Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`. The site appears at `https://<username>.github.io/<repo>/`.
