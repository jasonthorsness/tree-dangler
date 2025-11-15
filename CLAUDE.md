# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Outline

Tree Dangler is a react component for creating and simulating christmas tree ornaments. It comprises the following cascading modules:

0. Mask module: a region (with width/heigth) allowing the user to draw a single polygon by adding/removing points:
   a. start with a triangle, also minimum points is three.
   b. click a line segment to split into points
   c. click a point to select, then delete key or delete button to delete.

1. Input module: an embeddable region (with width/height) that allows the user to add line segments to a canvas.
   a. Click empty region to add a line segment.
   b. Click the line segment to select and move it.
   c. Click the line segment a second time to add/edit text superimposed over the line segment.
   d. Click the ends of the line segment to select and move them.
   e. Click a button or hit the delete key to remove a selected line segment.

Error/output check: no point may be outside the mask.

2. Module 2: this module uses d3-delauney to compute the voronoi diagram over the set of points including the ends of each line segment and a point added every 10 pixels along each line segment. The mask is ignored for this step. Then the polygons associated with the same line segment are merged together into larger polygons (interior lines discarded). The output of module 2 is this set of polygons.

3. Module 3: this module draws the voronoi diagram to a bitmap in black pixels on white, then also applies the mask from step zero (regions outside the polygon are drawn black) then calculates a euclidean distance field from the black pixels. Given a distance threshold, it then draws on a separate canvas the regions at least N pixels distant from the source. It also optionally adds noise to the distance (such as open-simplex). The output is the regions.

4. Module 4: this module traces each region using some library that converts bitmaps to polygons. The output is the set of polygons.

5. Module 5: this module displays the set of polygons (re-adding the overlay text) and allows the user to add fixed-length line segments representing connectors. This is very similar to the initial input module, except the line segments have no text and they are fixed length. If the user tries to drag a point to make it longer, it uses the direction the user is dragging to, but only goes the mandatory length in that direction from the other point.

6. Module 6: this module simulates the system of connected polygons using matter-js. The polygons are rigid bodies, and the connectors added in module 5 are stiff springs attached to the bodies at their start and stop point. Any start or stop point not falling onto a polygon is in a fixed position.

So the overall project is a series of panes, each say 400x400:

1. mask input pane
2. piece line segment input pane
3. voronoi display pane (no inputs)
4. module 3 display pane (with controls for threshold and noise)
5. connector line segment input pane
6. simulation display pane
7. svg for laser cutting pane (no text, just the pieces with 2mm holes around the ends of each connector) with download button.

## License

This project is licensed under the MIT License (Copyright 2025 Jason Thorsness).
