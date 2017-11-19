#! /usr/bin/env node
const { exec } = require("child_process");
const express = require("express");
const fs = require("fs");
const path = require("path");
const util = require("util");
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

const findSlides = path =>
  new Promise((resolve, reject) => {
    fs.readdir(path, (error, files) => {
      if (error) return reject(error);
      const slides = files.filter(f => f.endsWith(".md"));
      slides.length > 0 ? resolve(slides) : reject("No slides found");
    });
  });

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
  execAsPromise("git rev-parse --show-toplevel")
    .then(({ stdout: rootDir }) =>
      readYaml(path.join(rootDir.trim(), ".remark-serve.yml"))
    )
    .then(
      yamlOptions => {
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
            .map(url => `<link rel="stylesheet" href="${url}">`)
            .join("\n") + `<style>${style}</style>`
        ];
      },
      () => [
        "{}",
        defaultStylesheets
          .map(url => `<link rel="stylesheet" href="${url}">`)
          .join("\n") + `<style>${defaultCss}</style>`
      ]
    );

const app = express();

// Applying most used directories for assets
app.use("/assets", express.static("assets"));
app.use("/public", express.static("public"));
app.use("/resources", express.static("resources"));
app.use("/images", express.static("images"));

app.get("/:slide", function(request, result) {
  const slide = request.params.slide;
  if (fs.existsSync(slide)) {
    readFile(path.join(__dirname, "template.html"))
      .then(template =>
        Promise.all([
          template,
          readFile(path.join(currentDirectory, slide)),
          readOptions()
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
  } else {
    result.send(`file not found: ${slide}`);
  }
});

app.get("/", function(request, result) {
  findSlides(path.join(currentDirectory))
    .then(slides =>
      slides.map(file => `<div><a href="/${file}">${file}</a></div>`)
    )
    .then(slides =>
      Promise.all([slides, readFile(path.join(__dirname, "index.html"))])
    )
    .then(([slides, template]) =>
      result.send(template.replace("{{links}}", slides))
    )
    .catch(error => result.send(error));
});

const port = 3030;

console.log("Server started on http://localhost:" + port);
findSlides(path.join(currentDirectory))
  .then(slides => {
    console.log("\nFound these slides:\n");
    slides.forEach(slide => {
      console.log(`\thttp://localhost:${port}/${slide}`);
    });
  })
  .catch(console.error);
app.listen(port);
