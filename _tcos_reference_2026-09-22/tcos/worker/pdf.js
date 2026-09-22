/* =========================================================================
   Splitting a PDF into single pages.

   WHY THIS EXISTS, and why it was worth a dependency in a codebase that
   has refused them for everything else.

   Reading a 21-page report in ONE model call is unreliable. The same
   document, same model, same settings, returned 148 values one run and 86
   the next - and the second run's own self-check reported it had dropped
   HAEMATOLOGY, BIOCHEMISTRY, IMMUNOLOGY, the Differential Leucocyte Count
   and the Absolute Leucocyte Count. Those are blood results, not
   advertisements. Over that much document the model loses track, and how
   much it loses varies run to run.

   One page per call fixes three things at once:

     ACCURACY   each call is small enough to be done properly, and the
                answer stops changing between runs

     COST       the whole 2 MB document was being uploaded for every read,
                about ₹42 of input before a single value came out. One page
                is 382 KB, and only the pages worth reading are sent at all

     RECOVERY   a page that fails can be retried alone instead of redoing
                twenty-one pages

   pdf-lib is pure JavaScript with no native parts, so it runs in a Worker.
   That is the whole reason it is acceptable here: the rule this repo keeps
   is against dependencies that drag in a build step or a binary, and the
   thing it is protecting - a clinical reading nobody can trust - is exactly
   what this fixes.
   ========================================================================= */

import { PDFDocument } from 'pdf-lib';
import { badRequest } from '@tharigopula/core/lib';

export const pdf = {
  async pageCount(bytes) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  },

  /* Returns one single-page PDF per requested page, each carrying its own
     page number so a value can be traced back to the sheet it came from.

     `pages` are 1-based, because that is what the preflight reports and what
     a person counting pages in their hand would say. Anything outside the
     document is dropped rather than throwing: a preflight that names page 25
     of a 24-page report should cost us one missing page, not the whole
     reading. */
  async split(bytes, pages, perChunk = 3) {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = source.getPageCount();

    const wanted = (Array.isArray(pages) && pages.length
      ? pages
      : Array.from({ length: total }, (_, i) => i + 1))
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 1 && n <= total);

    if (!wanted.length) throw badRequest('There are no pages to read in that document.');

    const ordered = [...new Set(wanted)].sort((a, b) => a - b);
    const size = Math.max(1, Number(perChunk) || 1);
    const out = [];

    /* Grouped rather than one page each. pdf-lib copies the document's shared
       fonts and images into every extract, so a single page of this report
       came out at 382 KB when the whole 24-page file is 2 MB. Twenty-one
       single pages meant uploading 8 MB to read a 2 MB document, and the bill
       went from ₹77 to ₹314. Three pages share that overhead between them. */
    for (let i = 0; i < ordered.length; i += size) {
      const group = ordered.slice(i, i + size);
      const chunk = await PDFDocument.create();
      const copied = await chunk.copyPages(source, group.map(n => n - 1));
      for (const page of copied) chunk.addPage(page);
      out.push({
        page: group[0],           /* where this chunk starts, for labelling */
        pages: group,             /* the real page numbers inside it */
        bytes: await chunk.save()
      });
    }
    return out;
  }
};
