# Remark-serve

## Usage

Go into a directory with one or more remark `.md` files and launch `remark-serve`.

Each slides will have a URL.

## Installation

`npm install -g remark-serve`

## Options

You can have a YML file at the root of the repository where you want to use `remark-serve` with the following options.

`pattern: (string)` a glob pattern if you want to serve slides in recursively (ig: `"**/*.md"`).

`assets: (object)` a key-value object where keys are the route URL for the asset directory and values are the associated paths.

`css_files`: (array) list of CSS files that will be includes in the final HTML.
Can be either HTTP URLs or a local file.
A local file could be a SASS file.

`css`: (string) direct CSS that will be included

`remarkOptions`: (string) JavaScript options passed to the `remark.create(options)` call.
This must be a string to work.

Example:

```yaml
pattern: "**/*.md"
assets:
  "/images": "../assets/images/"
css_files:
  - https://fonts.googleapis.com/css?family=Open+Sans|Roboto:400,900
  - https://fonts.googleapis.com/css?family=Source+Code+Pro
css: >
  blockquote {
    color: green;
  }
remarkOptions: >
  {
    ratio: "16:9",
    highlightLanguage: "javascript",
    highlightStyle: "tomorrow",
    navigation: {
      scroll: false
    },
    slideNumberFormat: "%current%"
  }
```
