# BP Club

A Brownie Points (BP) leaderboard and power-up shop for the classroom. The teacher runs everything from one computer; students watch the leaderboard on the board or projector.

No installation, accounts or server. It is three files (`index.html`, `styles.css`, `app.js`) and everything is saved in the teacher's browser.

## Ranks

| Place | Title |
| --- | --- |
| 1st | **King** |
| 2nd | **Lord** |
| 3rd | **Knight** |
| Everyone else | **Subject** |

Students on the same BP share a place (two people on top are both Kings). You need at least some BP to hold a title.

## Power-ups

| Power-up | Cost | What it does |
| --- | --- | --- |
| Rage | 8 BP | Earn 2× BP for the next 2 weeks. Buying again adds another 2 weeks. |
| Fireball | 20 BP | Pick a person. They earn only ½ BP for 1 lesson (this lesson or next). |
| Minus Spell | 15 BP | Pick a person. They lose 8 BP. |
| Wheel of Fortune | 8 BP | Spin the wheel: double your BP, lose some, answer a question, spin again, make someone lose BP, steal BP, free Rage… |
| The Eternal Brownie | 40 BP | A real brownie baked by the teacher. Shows up in the **Brownies** tab until you mark it handed over. |

### How the effects work

- **Rage and Fireball change every BP a student earns while they are active.** That covers the Give BP buttons, the quick +1 / +5 buttons on the leaderboard, custom amounts, and BP won on the wheel (a "+BP" slice or a correct answer). With Rage, +1 adds 2. With Fireball, +1 adds ½. With both, +1 adds 1.
- Taking BP away is never doubled or halved.
- Rage ends on its own after 2 weeks. Fireball ends when you press **End lesson**.
- A Minus Spell hit stays on the leaderboard until the end of the lesson so everyone can see who did it. An unpaid brownie shows as "Brownie owed" until you mark it handed over.
- Everything active is listed under **Power-ups in play** on the leaderboard and on the projector. The +1 / +5 buttons show what they will really add (for example "+1 =2").
- Typing a number into the BP box on the **Students** tab sets the total directly, to fix mistakes. It ignores power-ups.

Prices, Rage length, the Minus Spell amount and every wheel slice can be changed in **Settings**.

## How to use it

1. Open `index.html` in Chrome, Edge or Firefox (or the GitHub Pages link below).
2. Choose **Load example class** to try it out, or **Start with an empty club**.
3. **Teacher login** with PIN `1234`, then change the PIN in **Settings**.
4. **Students**: paste your class list, one name per line.
5. **Give BP**: tap students, then tap an amount (+1, +5, −2…). Add a reason if you like. Rage and Fireball are applied automatically. The leaderboard also has quick +1 / +5 / −1 buttons when you are logged in.
6. **Power-ups**: press **Buy**, choose who is paying (and who gets hit for Fireball / Minus Spell). The BP comes off automatically. Buying a wheel spin opens the wheel straight away.
7. Press **End lesson** at the end of each lesson. This is what makes Fireball wear off.
8. **Projector view** opens a big-screen leaderboard with no buttons. It updates live as you give points from the main window on the same computer. Double-click it to go full screen.
9. **Lock** hides all the teacher controls so students can look but not touch.
10. **History** lists everything that happened; **Undo last action** (or Ctrl+Z) reverses mistakes.

## Keeping your data safe

All BP is stored in the browser on the teacher's computer (`localStorage`). It stays there between days, but it is lost if the browser's site data is cleared, and it does not move to another computer by itself.

Use **Settings → Download backup** regularly. **Restore from backup** loads that file on any computer.

The teacher PIN stops students clicking buttons on a shared screen. It is not real security, so don't reuse an important password.

## Putting it online (GitHub Pages)

1. On GitHub, open the repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, then **Save**.
3. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

Each computer that opens the link keeps its own copy of the data, so always run the club from the same teacher computer and browser.
