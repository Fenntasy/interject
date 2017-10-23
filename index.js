#! /usr/bin/env node
const express = require("express");
const fs = require("fs");
const path = require("path");

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

const app = express();
app.get("/:slide", function(request, result) {
  const slide = request.params.slide;
  if (fs.existsSync(slide)) {
    readFile(path.join(__dirname, "template.html"))
      .then(template =>
        Promise.all([template, readFile(path.join(currentDirectory, slide))])
      )
      .then(([template, data]) =>
        result.send(template.replace("{{slides}}", data))
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
