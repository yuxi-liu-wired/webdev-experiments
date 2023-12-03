---
title: Math Test
tags:
  - physics
  - math
  - tutorial
date: 2023-12-02
summary: $\nabla\cdot, \nabla, \nabla\times$, and all that.
show_source: True
---

## Math formulas

Inline citation is slightly awkward, but here it is:
$$
\int_{-\infty}^\infty e^{-\pi x^2}\,\mathrm{d}x=1\label{a}\tag{inline}
$$
and reference it here: $\ref{a}$

Todo: fix automatic numbering? Is it actually necessary though [Automatic Equation Numbering — MathJax 3.2 documentation](https://docs.mathjax.org/en/latest/input/tex/eqnumbers.html).

\begin{equation}
\int_{-\infty}^\infty e^{-\pi x^2}\,\mathrm{d}x=1\label{b}
\end{equation}
and reference it here: $\ref{b}$

```{theorem, label, name="Theorem name"}
Here is my theorem.
```

[@@bartoBitterLesson2019]

[@bartoBitterLesson2019]


$$\begin{align}
\dot{x} & = \sigma(y-x) \\
\dot{y} & = \rho x - y - xz \\
\dot{z} & = -\beta z + xy
\end{align}
$$

$$\frac{1}{(\sqrt{\phi \sqrt{5}}-\phi) e^{\frac25 \pi}} =
     1+\frac{e^{-2\pi}} {1+\frac{e^{-4\pi}} {1+\frac{e^{-6\pi}}
      {1+\frac{e^{-8\pi}} {1+\ldots} } } }$$

$$\begin{align}
  \nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} & = \frac{4\pi}{c}\vec{\mathbf{j}} \\
  \nabla \cdot \vec{\mathbf{E}} & = 4 \pi \rho \\
  \nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} & = \vec{\mathbf{0}} \\
  \nabla \cdot \vec{\mathbf{B}} & = 0
\end{align}
$$

## Images

![an image of a Rubik's cube](https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Rubik%27s_cube.svg/230px-Rubik%27s_cube.svg.png)

<div style="text-align: center;"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Rubik%27s_cube.svg/230px-Rubik%27s_cube.svg.png" />
<br><em>an image of a Rubik’s cube</em>
</div>


<div style="text-align: center;"><img src="{static}/images/Rubiks_cube.png" />
<br><em>an image of a Rubik’s cube served locally</em>
</div>

## Footnotes

Here is a footnote reference,[^1] and another.[^longnote]

[^1]: Here is the footnote.

[^longnote]: Here's one with multiple blocks.

    Subsequent paragraphs are indented to show that they belong to the previous footnote.

        { some.code }

    The whole paragraph can be indented, or just the first
    line.  In this way, multi-paragraph footnotes work like
    multi-paragraph list items.

This paragraph won't be part of the note, because it
isn't indented.

## Citations

Here is a citation reference,[#cit1] and another.[#cit2]

[#cit1]: This is the citation.

[#cit2]: Here's one with multiple blocks.

