# Math practice quiz

A single-page multiple choice quiz that runs in the browser. No build step, no
dependencies, no framework. Two files do the whole job: `index.html` holds the
layout and logic, `questions.json` holds the content.

Built as TerraNova warm-up practice for tenth grade, but nothing in the code is
tied to that. Swap the JSON and it becomes a quiz about anything.

## Files

```
index.html       the page: styles, quiz logic, print stylesheet
questions.json   the question set
```

## Running it

The page fetches `questions.json` at load, and browsers refuse to let a page
opened from `file://` read files next to it. Double-clicking `index.html` will
show a load error instead of the quiz. That is the browser's security model, not
a bug in the page.

Serve it over HTTP instead. From the folder containing both files:

```bash
python3 -m http.server
```

Then open <http://localhost:8000>.

## Deploying to GitHub Pages

1. Create a public repo and upload both files to the root.
2. Settings, then Pages, then set Source to "Deploy from a branch", branch
   `main`, folder `/ (root)`.
3. Wait about a minute. The live URL appears at the top of that same settings
   page, in the form `https://username.github.io/reponame/`.

Any static host works the same way. Netlify Drop takes a drag and drop of the
folder with no account.

Keep in mind that a Pages site on a public repo is readable by anyone who finds
the URL, and search engines can index it. Don't put names or school details in
the file.

## Editing the questions

`questions.json` looks like this:

```json
{
  "title": "Grade 10 Math Warm-Up",
  "intro": "One line under the heading.",
  "questions": [
    {
      "topic": "Percents",
      "prompt": "A jacket normally costs $48. It is on sale for 25% off. What is the sale price?",
      "options": ["$12", "$24", "$36", "$38"],
      "correct": 2,
      "hint": "25% off means you still pay 75% of the original price.",
      "why": "25% of $48 is $12, so the sale price is $36.",
      "ok": "Exactly right.",
      "no": "Close, check the last step."
    }
  ]
}
```

| Field | Required | What it does |
| --- | --- | --- |
| `prompt` | yes | The question. Inline HTML is allowed. |
| `options` | yes | Two to six answer choices. |
| `correct` | yes | Index into `options`, counting from zero. |
| `why` | no | Worked solution, shown after answering and in the printed key. |
| `topic` | no | Short label. Also used in the results breakdown. |
| `hint` | no | Shown when the reader clicks "Need a hint?". Omit it and the button disappears. |
| `ok` / `no` | no | Verdict lines. Default to "That's right." and "Not quite." |

The `correct` field trips people up. The first option is `0`, not `1`. The page
checks this on load and names the offending question rather than quietly marking
the wrong answer right.

To set an equation in monospace, wrap it: `<span class='expr'>3x - 7 = 20</span>`.
Plain text is fine too.

## Multiple question sets

Add a `?set=` parameter to load a different file from the same folder:

```
index.html?set=geometry.json
index.html?set=chapter7.json
```

One copy of the page, as many sets as you like. The heading and intro come from
whichever file loads.

## Printing

Ctrl+P or Cmd+P gives a clean worksheet. All questions on the first pages, the
answer key with full solutions on a fresh page after them. The interactive parts
are hidden in print. The `@media print` block at the bottom of the stylesheet
controls this.

## Things worth knowing

Fonts load from Google Fonts, so the page needs a connection to look as
designed. Offline it falls back to system fonts and every feature still works.

Scores live in memory only. Reloading starts over, and nothing is stored or sent
anywhere. There is no backend.

The progress ruler at the top draws its tick marks from the length of the
question array, so adding or removing questions needs no other change.
