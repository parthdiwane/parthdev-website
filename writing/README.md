# writing

Add your writing files here.

## Suggested structure

- `academic/`: research notes, essays, technical writing
- `personal/`: reflections, opinions, life updates
- `misc/`: anything else

## How to add a new piece

1. Copy the `article-template.html` file from the category folder you want to use.
2. Rename it to something like `my-new-piece.html`.
3. Edit the title, date, summary, and article body.
4. Add a matching entry in `../assets/js/writing-data.js`.

## Example `writing-data.js` entry

```js
{
  title: "My New Piece",
  category: "personal",
  writtenOn: "2026-04-13",
  addedOn: "2026-04-13",
  summary: "One short sentence for the writing list page.",
  href: "../writing/personal/my-new-piece.html"
}
```
