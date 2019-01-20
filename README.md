# befunge-sa: Static Analyzer for Befunge-93

This is a simple analyzer for [Befunge-93][1] that generates
and displays [control flow graphs][2] (CFGs) in the browser. It also
generates C code from the CFGs.

You can [try the analyzer online][3]. It comes with a few example
Befunge programs to test it with.

To build it you need the GHC Haskell toolchain, including [cabal][5],
in order to generate the necessary HTML from [MML][4] markup:

    $ git clone https://github.com/michael-olney/mml
    $ cd mml
    $ cabal install

Once you have the 'mml' command on your path, you can build the HTML
either by using the provided Makefile, or like this:

    $ mml befunge.mml

[1]: https://en.wikipedia.org/wiki/Befunge
[2]: https://en.wikipedia.org/wiki/Control_flow_graph
[3]: https://mpolney.github.com/befunge-sa/
[4]: https://github.com/mpolney/mml/
[5]: https://www.haskell.org/cabal/
