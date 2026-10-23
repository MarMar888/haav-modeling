# Newsletters

Each newsletter is a folder here. Write it, push it, then send it from **/admin** on the site.

```
newsletters/
  2026-11-kickoff/        <- the folder name is the newsletter's id (letters, numbers, - and _)
    newsletter.mdx        <- the text
    hull.jpg              <- any images it uses, in the same folder
```

To start one, copy `welcome/` and edit it. Folders that start with `_` or `.` are ignored.

## The file

A header, then the body. The body is Markdown, plus a few tags for things Markdown can't do (that is what makes
this MDX instead of Markdown).

```mdx
---
subject: Hull is printed          # required: the email subject line
preview: Four weeks, one hull.    # optional: the grey text next to the subject in the inbox
date: 2026-11-04                  # optional: shown under the logo as "November 2026"; also orders the list
---

# A heading

Normal paragraphs, **bold**, *italic*, [links](https://haav.build/join) and lists work as in Markdown.
Links that start with / point at haav.build.

![Alt text for a plain image](hull.jpg)

<Figure src="hull.jpg" alt="Describe the picture" caption="Optional caption underneath." />

<Button href="/join">Become a member</Button>
```

- **Images** are files in the same folder, named in `src`. Use `.jpg` or `.png` (some mail apps, notably desktop
  Outlook, cannot show `.webp`), and keep each under about 1 MB. Always fill in `alt`.
- The email loads its pictures from `haav.build/newsletters/<id>/`, so a new image only shows up in a preview or a
  send once the site is deployed with your files. Push first, then send the preview. If you swap an image after
  sending, give it a new file name.
- Do not write a bare `<` or `{` in text; MDX reads them as code. Write `&lt;` or `\{`.
- The logo header, the footer and the unsubscribe link are added automatically. The template lives in
  [`../src/emails/newsletter.tsx`](../src/emails/newsletter.tsx).

## Sending

1. Open **/admin** and enter the passcode.
2. **Preview** shows the email in the page. **Send preview** emails it to you alone.
3. **Send to everyone** sends it to the whole list as a Resend broadcast. Each newsletter can be sent once; the
   page shows when it went out.
