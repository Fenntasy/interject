#! /usr/bin/env node
const express = require("express");
const fs = require("fs");
const path = require("path");
const sass = require("node-sass");
const util = require("util");
const { exec } = require("child_process");
const { intersection } = require("lodash");
const tildeImporter = require('node-sass-tilde-importer');

const glob = util.promisify(require("glob"));
const readYaml = util.promisify(require("read-yaml"));

const execAsPromise = util.promisify(exec);

const currentDirectory = process.argv[2] || ".";

const readFile = path =>
  new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", (error, file) => {
      if (error) return reject(error);
      resolve(file);
    });
  });

const flatten = arrays => [].concat.apply([], arrays);

const defaultStylesheets = [
  "https://fonts.googleapis.com/css?family=Yanone+Kaffeesatz)",
  "https://fonts.googleapis.com/css?family=Droid+Serif:400,700,400italic",
  "https://fonts.googleapis.com/css?family=Ubuntu+Mono:400,700,400italic"
];

const defaultCss = `
body { font-family: 'Droid Serif'; }
h1, h2, h3 {
font-family: 'Yanone Kaffeesatz';
font-weight: normal;
}
.remark-code, .remark-inline-code { font-family: 'Ubuntu Mono'; }
img {
display: inline-block;
vertical-align: middle;
max-width: 100%;
height: auto; }
`;

const readOptions = () =>
  execAsPromise("git rev-parse --show-toplevel").then(({ stdout: rootDir }) =>
    readYaml(path.join(rootDir.trim(), ".remark-serve.yml"))
  );

const getStyles = yamlOptions => {
  const remarkOptions = yamlOptions.remarkOptions
    ? yamlOptions.remarkOptions
    : "{}";
  const stylesheets = yamlOptions.css_files
    ? yamlOptions.css_files
    : defaultStylesheets;
  const style = yamlOptions.css ? yamlOptions.css : defaultCss;
  return [
    remarkOptions,
    stylesheets
      .map(url => {
        if (url.startsWith("http")) {
          return `<link rel="stylesheet" href="${url}">`;
        } else {
          try {
            let style =
              url.endsWith(".scss") || url.endsWith(".sass")
                ? sass.renderSync({
                    file: url,
                    importer: tildeImporter
                  }).css
                : fs.readFileSync(url);
            return `<style>${style}</style>`;
          } catch (e) {
            console.warn(e)
            return `<style></style>`;
          }
        }
      })
      .join("\n") + `<style>${style}</style>`
  ];
};

const getDefaultStyles = () => [
  "{}",
  defaultStylesheets
    .map(url => `<link rel="stylesheet" href="${url}">`)
    .join("\n") + `<style>${defaultCss}</style>`
];

const app = express();
const port = 3030;

readOptions()
  .then(yamlOptions => {
    if (yamlOptions.assets) {
      Object.keys(yamlOptions.assets).forEach(route => {
        app.use(route, express.static(yamlOptions.assets[route]))
      })
    }
    const pattern = yamlOptions.pattern ? yamlOptions.pattern : "*.md";
    return glob(pattern, { ignore: ["node_modules/**"] });
  })
  .then(slides => {
    Array.from(new Set(slides.map(path.dirname))).forEach(directory => {
      // Applying most used directories for assets
      app.use(
        path.join(path.dirname(directory), "assets"),
        express.static(path.join(path.dirname(directory), "assets"))
      );
      app.use(
        path.join(path.dirname(directory), "public"),
        express.static(path.join(path.dirname(directory), "public"))
      );
      app.use(
        path.join(path.dirname(directory), "resources"),
        express.static(path.join(path.dirname(directory), "resources"))
      );
      app.use(
        path.join(path.dirname(directory), "images"),
        express.static(path.join(path.dirname(directory), "images"))
      );
    });

    slides.forEach(slide => {
      app.get(`/${slide}`, function(request, result) {
        readFile(path.join(__dirname, "template.html"))
          .then(template =>
            Promise.all([
              template,
              readFile(path.join(currentDirectory, slide)),
              readOptions().then(getStyles, getDefaultStyles)
            ])
          )
          .then(([template, data, [remarkOptions, styles]]) =>
            result.send(
              template
                .replace("{{styles}}", styles)
                .replace("{{remarkOptions}}", remarkOptions)
                .replace("{{slides}}", data)
            )
          )
          .catch(error => result.send(error));
      });
    });

    app.get("/", function(request, result) {
      result.send(
        Object.entries(
          slides.reduce((slidesPerDirectory, slide) => {
            if (!slidesPerDirectory[path.dirname(slide)]) {
              slidesPerDirectory[path.dirname(slide)] = [];
            }
            slidesPerDirectory[path.dirname(slide)] = [
              ...slidesPerDirectory[path.dirname(slide)],
              slide
            ];
            return slidesPerDirectory;
          }, {})
        )
          .map(
            ([directory, slides]) =>
              `<section>
                  <h1>${directory}</h1>
                  <ul>
                    ${slides
                      .map(
                        file =>
                          `<li><a href="/${file}">${path.basename(
                            file
                          )}</a></li>`
                      )
                      .join("")}
                  </ul>
               </section>`
          )
          .join("")
      );
    });

    Promise.all([
      execAsPromise(
        "{ git diff --name-only ; git diff --name-only --staged ; } | sort | uniq"
      ).then(({ stdout: files }) => files.split("\n")),
      execAsPromise("git ls-files --other --exclude-standard").then(
        ({ stdout: files }) => files.split("\n")
      )
    ])
      .then(flatten)
      .then(gitModifiedFiles => {
        console.log(
          `\nFound ${
            slides.length
          } slides:\n\n  See them all on http://localhost:${port}`
        );

        lastSlidesModified = intersection(gitModifiedFiles, slides);
        if (lastSlidesModified.length > 0) {
          console.log("\n  These are new in git:\n");
          lastSlidesModified.forEach(slide => {
            console.log(`    http://localhost:${port}/${slide}`);
          });
        }
      });
  });

app.listen(port, () => {
  console.log("Server loading");
});
