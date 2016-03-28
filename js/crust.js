var GRID_COLOR = '#6dcff6';
var STROKE_COLOR = '#333';
var SAMPLE_STROKE_COLOR = '#F0A830';
var TRI_COLOR = '#78C0A8';
var STROKE_WIDTH = 1;
var SAMPLE_STROKE_WIDTH = 4;
var DELAUNAY_PT_RADIUS = 5;
var SAMPLING_RATE = 0.01;


$(function() {
  var edgeList = [];
  var tris = []
  var medialAxis = [];
  var colorStuff = [];
  var data = [];
  var epsilons = {};

  var canvas = document.getElementById('canvas');
  $canvas = $(canvas);
  var two = new Two({
    width: $canvas.width(),
    height: $(window).height()
  }).appendTo(canvas);

  createGrid();



  var x, y, curve, dot, mouse = new Two.Vector();

  var drag = function(e) {
    x = e.pageX;
    y = e.pageY;
    if (!curve) {
      curve = two.makePath();
      curve.vertices = [new Two.Anchor(x, y)]
      curve.noFill().stroke = STROKE_COLOR;
      curve.linewidth = STROKE_WIDTH;
    } else {
      curve.vertices.push(new Two.Anchor(x, y));
    }
    two.update();
  };

  var dragEnd = function(e) {
    $canvas
      .unbind('mousemove', drag)
      .unbind('mouseup', dragEnd)
      .unbind('mousedown');

    two.remove(curve);

    sampledCurve = new Two.Path([], true);
    sampledCurve.noFill();
    sampledCurve.stroke = SAMPLE_STROKE_COLOR;
    sampledCurve.linewidth = SAMPLE_STROKE_WIDTH;
    sample(SAMPLING_RATE);

    polyKCurve = toPolyK(sampledCurve);

    contour = [];
    sampledCurve.vertices.forEach(function(v) {
      contour.push(new poly2tri.Point(v.x, v.y));
    })
    var swctx = new poly2tri.SweepContext(contour);
    swctx.triangulate();
    var triangles = swctx.getTriangles();
    triangles.forEach(function(t) {
      var tri = makePoly([t.getPoint(0).x, t.getPoint(0).y,
        t.getPoint(1).x, t.getPoint(1).y, t.getPoint(2).x, t.getPoint(2).y
      ])
      tri.fill = TRI_COLOR;
      tri = permuteTriVertices(tri);
      tris.push(tri);
      two.add(tri);
    });

    two.add(sampledCurve);

    buildEdgeList();

    edgeList.forEach(function(tris) {
      var center1 = getCircumcenter(tris[0]);
      var center2 = getCircumcenter(tris[1]);

      if (PolyK.ContainsPoint(polyKCurve, center1.x, center1.y) && PolyK.ContainsPoint(polyKCurve, center2.x, center2.y)) {
        var edge = two.makePath();
        edge.vertices = [center1, center2];
        edge.noFill().stroke = STROKE_COLOR;
        edge.linewidth = STROKE_WIDTH;
        medialAxis.push(edge);
      }
    });

    for (var i = 10; i < 333; i += 5)
    {
      sample(i/1000);
      epsilons[i] = getEpsilon();
    }
    console.log(epsilons);
    var eSlider = $("#epsilon-slider").slider({
      formatter: function(value) {
        sample(value/1000);
        data.push([value/1000, epsilons[value]]);
        updateData();
      }
    });

    two.update();
  };

  function colorDemo(on) {
    if (on) {
      edgeList.forEach(function(tris) {
        var center1 = getCircumcenter(tris[0]);
        var center2 = getCircumcenter(tris[1]);

        var color1 = '#' + Math.floor(Math.random() * 16777215).toString(16);
        var color2 = '#' + Math.floor(Math.random() * 16777215).toString(16);

        tris[0].fill = color1;
        tris[1].fill = color2;

        var c1 = two.makeCircle(center1.x, center1.y, Math.log(PolyK.GetArea(toPolyK(tris[0]))));
        var c2 = two.makeCircle(center2.x, center2.y, Math.log(PolyK.GetArea(toPolyK(tris[1]))));
        c1.fill = color1;
        c2.fill = color2;

        var r1 = getCircumradius(tris[0], center1);
        var r2 = getCircumradius(tris[1], center2);

        var cc1 = two.makeCircle(center1.x, center1.y, r1).noFill();
        var cc2 = two.makeCircle(center2.x, center2.y, r2).noFill();
        cc1.linewidth = STROKE_WIDTH;
        cc2.linewidth = STROKE_WIDTH;
        cc1.stroke = color1;
        cc2.stroke = color2;

        colorStuff.push(c1, c2, cc1, cc2);
      });
    } else {
      colorStuff.forEach(function(thing) {
        two.remove(thing);
      })
      colorStuff = [];
      tris.forEach(function(tri) {
        tri.fill = TRI_COLOR;
      });
    }
    two.update();
  }

  function getCircumradius(tri, center) {
    A = tri.vertices[0];
    return A.distanceTo(center);
  }

  function sample(rate) {
    var n = curve.vertices.length;
    var sampleSize = Math.ceil(rate * n);
    var sampledVertices = [];
    for (var i = 0; i < n; i += sampleSize) {
      sampledVertices.push(new Two.Vector().copy(curve.vertices[i]));
    }
    sampledCurve.vertices = sampledVertices;

    two.update();
  }

  function getEpsilon() {
    var globalEpsilon = 0;
    var epsilon = Infinity;
    curve.vertices.forEach(function(p) {
      sampledCurve.vertices.forEach(function(x) {
        if (!(x.x == p.x && x.y == p.y)) {
          epsilon = Math.min(epsilon, x.distanceTo(p) / getLocFeatSize(x));
        }
      })
      globalEpsilon = Math.max(epsilon, globalEpsilon);
      epsilon = Infinity;
    });

    return globalEpsilon;
  }


  function getLocFeatSize(p) {
    size = Infinity;
    medialAxis.forEach(function(e) {
      size = Math.min(size, pDistance(p.x, p.y,
        e.vertices[0].x, e.vertices[0].y, e.vertices[1].x, e.vertices[1].y));
    });
    return size;
  }

  function pDistance(x, y, x1, y1, x2, y2) {

    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;

    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    if (len_sq != 0) //in case of 0 length line
      param = dot / len_sq;

    var xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    var dx = x - xx;
    var dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }


  function permuteTriVertices(t) {
    var a = t.vertices[0];
    var b = t.vertices[1];
    var c = t.vertices[2];
    var ab = a.distanceTo(b);
    var ac = a.distanceTo(c);
    var bc = b.distanceTo(c);
    var max = Math.max(ab, ac, bc);

    var perm;
    if (max == ab) {
      perm = [a, b, c];
    } else if (max == ac) {
      perm = [c, a, b];
    } else {
      perm = [b, c, a];
    }

    t.vertices = perm;
    return t;
  }


  function createGrid(s) {

    var size = s || 30;
    var two = new Two({
      type: Two.Types.canvas,
      width: size,
      height: size
    });

    var a = two.makeLine(two.width / 2, 0, two.width / 2, two.height);
    var b = two.makeLine(0, two.height / 2, two.width, two.height / 2);
    a.stroke = b.stroke = GRID_COLOR;

    two.update();

    _.defer(function() {
      $(document.body).css({
        background: 'url(' + two.renderer.domElement.toDataURL('image/png') + ') 0 0 repeat',
        backgroundSize: size + 'px ' + size + 'px'
      });
    });

  }


  function buildEdgeList() {
    for (var i = 0; i < tris.length - 1; i++) {
      for (var j = i + 1; j < tris.length; j++) {
        var count = 0;
        for (var a = 0; a < tris[i].vertices.length; a++) {
          for (var b = 0; b < tris[j].vertices.length; b++) {
            if (tris[i].vertices[a].x == tris[j].vertices[b].x &&
              tris[i].vertices[a].y == tris[j].vertices[b].y) {
              count++;
            }
          }
        }
        if (count == 2) {
          edgeList.push([tris[i], tris[j]]);
        }
      }
    }
  }

  function makePoly(p) {
    points = [];
    for (var i = 0; i < p.length; i += 2) {
      var x = p[i];
      var y = p[i + 1];
      points.push(new Two.Anchor(x, y));
    }

    var path = new Two.Path(points, true);
    path.stroke = 'white';

    return path;

  }

  function getCircumcenter(tri) {
    A = tri.vertices[0];
    B = tri.vertices[1];
    C = tri.vertices[2];

    D = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    X = ((A.x * A.x + A.y * A.y) * (B.y - C.y) +
      (B.x * B.x + B.y * B.y) * (C.y - A.y) +
      (C.x * C.x + C.y * C.y) * (A.y - B.y)) / D;
    Y = ((A.x * A.x + A.y * A.y) * (C.x - B.x) +
      (B.x * B.x + B.y * B.y) * (A.x - C.x) +
      (C.x * C.x + C.y * C.y) * (B.x - A.x)) / D;

    return new Two.Anchor(X, Y);
  }

  function toPolyK(p) {
    return $.map(p.vertices, function(v) {
      return [v.x, v.y];
    })
  }

  $canvas
    .bind('mousedown', function(e) {
      curve = null;
      $canvas
        .bind('mousemove', drag)
        .bind('mouseup', dragEnd);
    });

  $("#color-demo").bootstrapSwitch();
  $("#color-demo").on('switchChange.bootstrapSwitch', function(event, state) {
    colorDemo(state);
  });


  // Setup settings for graphic
  var margin = {
      top: 50,
      right: 15,
      bottom: 60,
      left: 60
    },
    width = 500 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  var graphX = d3.scale.linear()
    .domain([0, 0.35])
    .range([0, width]);

  var graphY = d3.scale.linear()
    .domain([0, 10])
    .range([height, 0]);

  var chart = d3.select('#graph')
    .append('svg:svg')
    .attr('width', width + margin.right + margin.left)
    .attr('height', height + margin.top + margin.bottom)
    .attr('class', 'chart')

  var main = chart.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'main')

  // draw the x axis
  var xAxis = d3.svg.axis()
    .scale(graphX)
    .orient('bottom');

  main.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .attr('class', 'main axis date')
    .call(xAxis);

  // draw the y axis
  var yAxis = d3.svg.axis()
    .scale(graphY)
    .orient('left');

  main.append('g')
    .attr('transform', 'translate(0,0)')
    .attr('class', 'main axis date')
    .call(yAxis);

  var g = main.append("svg:g");

  g.selectAll("scatter-dots")
    .data(data)
    .enter().append("svg:circle")
    .attr("cx", function(d, i) {
      return x(d[0]);
    })
    .attr("cy", function(d) {
      return y(d[1]);
    })
    .attr("r", 8);

  main.append("text")
    .attr("text-anchor", "middle") // this makes it easy to centre the text as the transform is applied to the anchor
    .attr("transform", "translate(-35," + (height / 2) + ")rotate(-90)") // text is drawn off the screen top left, move down and out and rotate
    .text("epsilon");

  main.append("text")
    .attr("text-anchor", "middle") // this makes it easy to centre the text as the transform is applied to the anchor
    .attr("transform", "translate(" + (width / 2) + "," + (height + 45) + ")") // centre below axis
    .text("Sampling rate");

  function updateData() {

    g.selectAll("scatter-dots")
      .remove();

    g.selectAll("scatter-dots")
      .data(data)
      .enter().append("svg:circle")
      .attr("cx", function(d, i) {
        return graphX(d[0]);
      })
      .attr("cy", function(d) {
        return graphY(d[1]);
      })
      .attr("r", 8);

  }

});
