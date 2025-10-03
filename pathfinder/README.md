Pathfinder




pathfinder.js contain debugging; How to Use
-Open your Pathfinder page in the browser.
-Press F12 (or right click → Inspect → Console).
You’ll now see logs like:

[Pathfinder] Switching tab: spells
[Pathfinder] Filtering spells...
[Pathfinder] Filters → { classFilter: "Wizard", levelFilter: "3", ... }
[Pathfinder] Adding known spell: Fireball


If something doesn’t update, the logs will tell you where it stopped.

If you want to silence logs, just set:

const DEBUG = false;
