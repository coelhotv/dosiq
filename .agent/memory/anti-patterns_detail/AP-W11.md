# AP-W11 — Pass a prop to an internal sub-component JSX but omit it from the function signature

**Category:** Ui
**Status:** active
**Related Rule:** R-103
**Applies To:** all

## Problem

Prop silently ignored; feature broken with no error or warning in runtime or tests

## Prevention

List ALL interaction props in destructuring; add click/interaction test for each callback
