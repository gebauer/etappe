/// <reference path="../pb_data/types.d.ts" />

// Photo pipeline (WORK 7.2): PocketBase generates thumbs server-side from a
// `thumbs` size list on the file field (BUILD §5: "PocketBase generating the
// thumb server-side via its thumb parameter"). `blocks.file` had no sizes
// configured — add a small row thumbnail and a larger preview/display size.
// Non-image files (kind "file") just ignore the thumb param, so this is safe
// to set even though the field is shared with non-photo blocks.

migrate(
  (app) => {
    const blocks = app.findCollectionByNameOrId('blocks');
    const file = blocks.fields.getByName('file');
    file.thumbs = ['80x80', '640x0'];
    app.save(blocks);
  },
  (app) => {
    const blocks = app.findCollectionByNameOrId('blocks');
    const file = blocks.fields.getByName('file');
    file.thumbs = [];
    app.save(blocks);
  },
);
