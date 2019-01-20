function Vec2(x, y) {
    this.x = x;
    this.y = y;
    this.add = function(other) {
        this.x += other.x;
        this.y += other.y;
    }

    var mod = function(x, m) {
        x %= m;
        if (x < 0)
            x += m;
        return x;
    }

    this.mod = function(other) {
        this.x = mod(this.x, other.x);
        this.y = mod(this.y, other.y);
    }

    this.equal = function(other) {
        return (other.x == this.x) && (other.y == this.y);
    }

    this.clone = function() {
        return new Vec2(this.x, this.y);
    }
    this.toString = function() {
        return "(" + this.x.toString() + ", " + this.y.toString() + ")";
    }
}

function PC(pos, dir, quoting) {
    this.pos = pos;
    this.dir = dir;
    this.quoting = quoting;

    this.advance = function() {
        this.pos.add(this.dir)
        this.pos.mod(Befunge.DIMENSIONS);
    }

    this.clone = function() {
        return new PC(this.pos.clone(), this.dir.clone(), this.quoting);
    }
    this.toString = function() {
        return "("
            + this.pos.toString()
            + ", " + this.dir.toString()
            + ", " + this.quoting.toString()
            + ")";
    }
}

function StackEntry(type, val) {
    this.type = type;
    this.val = val;
}

function Ctx(pc, block) {
    this.pc = pc;
    this.block = block;
}

function Befunge() {
    this.map = new Array();

    var assign = (cs, typeStr) => {
        for (var i = 0; i < cs.length; ++i)
            this.map[cs[i]] = typeStr;
    }

    assign("0123456789", "literal");
    assign("<>^v", "uncond_branch");
    assign("_|?", "cond_branch");
    assign("#", "skip");
    assign("g", "load");
    assign("p", "store");
    assign(",.", "out");
    assign(":\\$", "stack_op");
    assign("!", "unary_op");
    assign("+-/*`", "binary_op");
    assign(" ", "space");
    assign("@", "terminate")
    assign("\"", "quote");

    this.insType = (c) => {
        return this.map[c];
    }
}

Befunge.WIDTH = 80;
Befunge.HEIGHT = 25;
Befunge.DIMENSIONS = new Vec2(Befunge.WIDTH, Befunge.HEIGHT);
Befunge.zeroDir = function(char) {
    if (char == "_") return new Vec2(1, 0);
    if (char == "|") return new Vec2(0, 1);
    throw "bad conditional branch instruction"
};
Befunge.branchCondFromDir = function(char, dir) {
    if ((char == "_") || (char == "|")) {
        if (Befunge.zeroDir(char).equal(dir))
            return BranchPath.COND_EQ_ZERO;
        return BranchPath.COND_NEQ_ZERO;
    }
    if (char == "?")
        return BranchPath.COND_RANDOM;
    throw "bad conditional branch instruction"
};
Befunge.uncondBranchDir = function(c) {
    if (c == "<") return new Vec2(-1, 0);
    if (c == ">") return new Vec2(1, 0);
    if (c == "^") return new Vec2(0, -1);
    if (c == "v") return new Vec2(0, 1);
    throw "bad unconditional branch instruction"
}
Befunge.condBranchDirs = function(c) {
    if (c == "_") return new Array(new Vec2(-1, 0), new Vec2(1, 0));
    if (c == "|") return new Array(new Vec2(0, -1), new Vec2(0, 1));
    if (c == "?") return new Array(
        new Vec2(0, -1), new Vec2(0, 1),
        new Vec2(-1, 0), new Vec2(1, 0)
    );
    throw "bad conditional branch instruction"
}

function Prog(progtext) {
    this.progtext = progtext;

    var lines = progtext.split(/\r?\n/);

    this.prog = new Array();
    for (var x = 0; x < Befunge.WIDTH; ++x) {
        var col = new Array();
        for (var y = 0; y < Befunge.HEIGHT; ++y) {
            col.push(" ");
        }
        this.prog.push(col);
    }

    for (var y = 0; y < lines.length; ++y) {
        for (var x = 0; x < lines[y].length; ++x) {
            this.prog[x][y] = lines[y][x];
        }
    }

    this.cell = function(vec) {
        var wrapVec = vec.clone();
        wrapVec.mod(Befunge.DIMENSIONS)
        return this.prog[wrapVec.x][wrapVec.y];
    }
}

function BranchPath(isCond, block) {
    this.isCond = isCond;
    this.block = block;

    this.toString = function() {
        var s = "#" + this.block.id.toString();
        if (isCond)
            s += "[" + BranchPath.condToString(this.cond) + "]";
        return s;
    };
}

BranchPath.COND_EQ_ZERO = 0;
BranchPath.COND_NEQ_ZERO = 1;
BranchPath.COND_RANDOM = 2;
BranchPath.condToString = function(cond) {
    if (cond == BranchPath.COND_EQ_ZERO) return "=0";
    if (cond == BranchPath.COND_NEQ_ZERO) return "!=0";
    if (cond == BranchPath.COND_RANDOM) return "(random)";
    throw "unknown condition";
};

function Branch(isCond) {
    this.isCond = isCond;
    this.paths = new Array();

    this.toString = function() {
        var s = "";
        if (this.isCond)
            s += "(cond) ";
        else
            s += "(uncond)";
        for (var i = 0; i < this.paths.length; ++i) {
            var path = this.paths[i];
            s += " " + path.toString();
        }
        s += "\n";
        return s;
    }
}

function PseudoInsString() {
    this.string = "";

    this.accumulate = function(c) {
        this.string += c;
    }
    this.toString = function() {
        return "\"" + this.string + "\"";
    }
}

function Block(id) {
    this.id = id;
    this.linearIns = new Array();
    this.indexToLinear = new Array();
    this.isProgramStart = false;
    this.outBranch = null;

    this.isNop = function() {
        return ((this.outBranch != null)
            && (this.linearIns.length == 0)
            && (!this.outBranch.isCond));
    };

    var outBranchToString = () => {
        if (this.outBranch == null)
            return "(null)\n";
        return this.outBranch.toString()
    }

    this.toString = function() {
        var s = "BLOCK #" + this.id.toString() + " {\n";
        s += "\tprogram start? " + this.isProgramStart + "\n";
        s += "\tlinear instructions: ";
        for (var i = 0; i < this.linearIns.length; ++i) {
            s += this.linearIns[i];
        }
        s += "\n";
        s += "\tout branch: " + outBranchToString();
        s += "}\n";
        return s;
    }
}

function Analyzer(progtext) {
    nextBlockId = 0;

    this.mProg = new Prog(progtext);
    this.befunge = new Befunge();

    this.nextBlockId = 0;

    var createBlock = () => {
        return new Block(this.nextBlockId++);
    }

    var startBlock = createBlock();
    startBlock.isProgramStart = true;
    this.blockList = new Array(startBlock);
    this.blockMap = new Array();

    this.ctxs = new Array(
        new Ctx(
            new PC(new Vec2(0, 0), new Vec2(1, 0), false),
            this.blockList[0]
        )
    );

    var updateBranch = function(branch, from, to) {
        if (branch == null)
            return;

        for (var i = 0; i < branch.paths.length; ++i) {
            if (branch.paths[i].block.id == from.id)
                branch.paths[i].block = to;
        }
    }

    var splitBlock = (victim, index) => {
        var headBlock = createBlock(); /* victim becomes tail block */
        headBlock.outBranch = new Branch(false);
        headBlock.outBranch.paths.push(new BranchPath(false, victim));

        headBlock.linearIns = victim.linearIns.slice(0, index);
        victim.linearIns = victim.linearIns.slice(index);

        for (var i = 0; i < this.blockList.length; ++i) {
            updateBranch(
                this.blockList[i].outBranch,
                victim, headBlock
            );
        }

        if (victim.isProgramStart) {
            headBlock.isProgramStart = true;
            victim.isProgramStart = false;
        }

        for (var pc in victim.indexToLinear) {
            var index2 = victim.indexToLinear[pc];
            if (index2 < index) {
                this.blockMap[pc] = headBlock;
                headBlock.indexToLinear[pc] = index2;
                delete victim.indexToLinear[pc];
            } else {
                victim.indexToLinear[pc] -= index;
            }
        }

        this.blockList.push(headBlock);
    }

    var assignLinearIndex = function(block, pc, off) {
        var linearIndex = block.linearIns.length + off;
        block.indexToLinear[pc.toString()] = linearIndex;
    }

    this.calcBasicBlocks = function() {
        var handleCondBranch = (char, pc, block) => {
            var dirs = Befunge.condBranchDirs(char);
            block.outBranch = new Branch(true);
            for (var i = 0; i < dirs.length; ++i) {
                var dir = dirs[i];
                var newPC = pc.clone();
                newPC.dir = dir;
                newPC.advance();
                var newBlock = createBlock();
                this.blockList.push(newBlock);
                var newCtx = new Ctx(newPC, newBlock);
                this.ctxs.push(newCtx);
                var path = new BranchPath(true, newBlock);
                path.cond = Befunge.branchCondFromDir(char, dir);
                block.outBranch.paths.push(path);
            }
        };

        var elimEmptyBlocks = () => {
            for (var i = 0; i < this.blockList.length;) {
                var block = this.blockList[i];
                if (block.isNop()) {
                    var nextBlock = block.outBranch.paths[0].block;
                    for (var j = 0; j < this.blockList.length; ++j) {
                        var updateBlock = this.blockList[j];
                        updateBranch(updateBlock.outBranch, block, nextBlock);
                    }
                    this.blockList.splice(i, 1);
                } else {
                    ++i;
                }
            }
        };

        var blockMap = this.blockMap;
        blockMap.splice(0, blockMap.length);

        while (this.ctxs.length != 0) {
            var ctx = this.ctxs.pop();
            var pc = ctx.pc;
            var block = ctx.block;

            if (pc.toString() in blockMap) {
                var victim = blockMap[pc.toString()];
                var index = victim.indexToLinear[pc.toString()];
                if (index == undefined)
                    throw "no index-to-linear entry";
                if (index > 0)
                    splitBlock(victim, index);
                block.outBranch = new Branch(false);
                block.outBranch.paths.push(new BranchPath(false, victim));
                continue;
            }
            blockMap[pc.toString()] = block;

            var char = this.mProg.cell(pc.pos);
            var insType = this.befunge.insType(char);

            console.log(pc.toString() + ": " + char + " (" + insType + ")");

            if (pc.quoting) {
                if (insType == "quote") {
                    assignLinearIndex(block, pc, -1);
                    pc.quoting = false;
                    pc.advance();
                    this.ctxs.push(ctx);
                } else {
                    assignLinearIndex(block, pc, -1);
                    block.linearIns[block.linearIns.length - 1].accumulate(char);
                    pc.advance();
                    this.ctxs.push(ctx);
                }
            } else if (insType == "quote") {
                assignLinearIndex(block, pc, 0);
                pc.quoting = true;
                block.linearIns.push(new PseudoInsString());
                pc.advance();
                this.ctxs.push(ctx);
            } else if (insType == "cond_branch") {
                assignLinearIndex(block, pc, 0);
                handleCondBranch(char, pc, block);
            } else if (insType == "uncond_branch") {
                assignLinearIndex(block, pc, 0);
                pc.dir = Befunge.uncondBranchDir(char);
                pc.advance();
                this.ctxs.push(ctx);
            } else if (insType == "skip") {
                assignLinearIndex(block, pc, 0);
                pc.advance();
                pc.advance();
                this.ctxs.push(ctx);
            } else {
                if (insType == "space") {
                    assignLinearIndex(block, pc, 0);
                } else {
                    assignLinearIndex(block, pc, 0);
                    block.linearIns.push(char);
                }
                pc.advance();
                if (insType != "terminate")
                    this.ctxs.push(ctx);
            }
        }

        elimEmptyBlocks();
    };
    this.analyze = function() {
        this.calcBasicBlocks();
    }
    this.blocks = function() {
        return this.blockList;
    }
    this.prog = function() {
        return this.mProg;
    }
}

function Visualizer(analyzer) {
    this.analyzer = analyzer;

    this.visualize = function(div) {
        var blocks = this.analyzer.blocks();
        var nodeList = [];
        var edgeList = [];
        for (var i = 0; i < blocks.length; ++i) {
            var block = blocks[i];
            var label = block.linearIns;
            var splitLabel = [];
            for (var j = 0; j < label.length; ++j) {
                splitLabel.push(label[j]);
                if ((j != 0) && (j % 16 == 0))
                    splitLabel.push("\n");
            }
            label = splitLabel;
            label = label.join("");
            var node = {
                id: block.id, label: label,
                shape:  "box"
            };
            if (block.outBranch == null)
                node.color = "#FF7070";
            if (block.isProgramStart) {
                node.color = "#70FF70";
                node.borderWidth = 4;
            }
            nodeList.push(node);
            if (block.outBranch == null)
                continue;
            var outBranch = block.outBranch;
            var dashes = outBranch.isCond;

            for (var j = 0; j < outBranch.paths.length; ++j) {
                var path = outBranch.paths[j];
                var destBlock = path.block;
                var edge = {
                    from: block.id,
                    to: destBlock.id,
                    arrows: "to",
                    dashes: dashes
                };

                if (path.isCond)
                    edge.label = BranchPath.condToString(path.cond);

                edgeList.push(edge);
            }
        }
        var nodes = new vis.DataSet(nodeList);
        var edges = new vis.DataSet(edgeList);
        var data = {nodes: nodes, edges: edges};
        var options = {};
        var network = new vis.Network(div, data, options);
    }
}

function CodeGeneratorC(blocks, prog) {
    this.blocks = blocks.splice();
    this.text = "";
    this.tabLevel = 0;
    this.prog = prog;

    var printLn = (line) => {
        for (var i = 0; i < this.tabLevel; ++i)
            this.text += "    ";
        this.text += line;
        this.text += "\n";
    }

    var indent = () => {
        ++this.tabLevel;
    }

    var dedent = () => {
        --this.tabLevel;
    }

    var push = (exp) => {
        printLn("push(" + exp + ");");
    }

    var pop = () => {
        printLn("pop();");
    }

    var binaryOp = (op) => {
        printLn("{");
        indent();
            printLn("int a = top(), b = snd();");
            pop();
            pop();
            push("b " + op + " a");
        dedent();
        printLn("}");
    }

    var genInstruction = (ins) => {
        if (ins == "$") {
            pop();
        } else if (ins == ":") {
            push("top()")
        } else if (ins == "\\") {
            printLn("{");
            indent();
                printLn("int t = top();")
                printLn("int s = snd();")
                pop();
                pop();
                push("t");
                push("s");
            dedent();
            printLn("}");
        } else if (ins == "@") {
            printLn("exit(0);")
        } else if (ins == ".") {
            printLn("printf(\"%d \", top());");
            pop();
        } else if (ins == ",") {
            printLn("printf(\"%c\", (char)top());");
            pop();
        } else if (ins == "&") {
            printLn("{");
            indent();
                printLn("int v = 0;");
                printLn("scanf(\"%d\", &v);");
                push("v");
            dedent();
            printLn("}");
        } else if (ins == "~") {
            printLn("{");
            indent();
                printLn("char v = 0;");
                printLn("scanf(\"%c\", &v);");
                push("v");
            dedent();
            printLn("}");
        } else if (ins == "g") {
            printLn("{");
            indent();
                printLn("int x = ((snd() % W) + W) % W;");
                printLn("int y = ((top() % H) + H) % H;");
                pop();
                pop();
                push("mem[x][y]");
            dedent();
            printLn("}");
        } else if (ins == "p") {
            printLn("{");
            indent();
                printLn("int v = thd();");
                printLn("int x = ((snd() % W) + W) % W;");
                printLn("int y = ((top() % H) + H) % H;");
                pop();
                pop();
                pop();
                printLn("mem[x][y] = v;");
            dedent();
            printLn("}");
        } else if (ins == "!") {
            printLn("{");
            indent();
                printLn("int v = top();");
                pop();
                printLn("if (v == 0) push(1);");
                printLn("else push(0);")
            dedent();
            printLn("}");
        } else if (ins == "-") {
            binaryOp("-");
        } else if (ins == "+") {
            binaryOp("+");
        } else if (ins == "*") {
            binaryOp("*");
        } else if (ins == "/") {
            binaryOp("/");
        } else if (ins == "%") {
            binaryOp("%");
        } else if (ins == "`") {
            printLn("{");
            indent();
                printLn("int a = top(), b = snd();");
                pop();
                pop();
                printLn("if (b > a) push(1);");
                printLn("else push(0);");
            printLn("}");
            dedent();
        } else if (typeof ins == "string") {
            var code = ins.charCodeAt(0);
            if ((code >= "0".charCodeAt(0)) && (code <= "9".charCodeAt(0))) {
                var val = code - "0".charCodeAt(0);
                push(val.toString());
            } else {
                throw("unknown instruction: " + ins);
            }
        } else if (typeof ins == "object") { /* pseudo-instruction */
            if (ins instanceof PseudoInsString) {
                printLn("{");
                indent();
                    printLn("char *string = \"" + ins.string + "\";");
                    var len = ins.string.length.toString();
                    printLn("for (int i = 0; i < " + len + "; ++i) {");
                    indent();
                        push("string[i]");
                    dedent();
                    printLn("}");
                dedent();
                printLn("}");
            } else {
                throw "unrecognized pseudo-instruction";
            }
        } else {
            printLn("/* unknown instruction */");
        }
    }

    var genBlock = (block, id) => {
        printLn("void block_" + id + "(void) {");
        indent();

        //printLn("printf(\"block_" + id + "\\n\");");

        for (var i = 0; i < block.linearIns.length; ++i) {
            genInstruction(block.linearIns[i]);
        }

        if (block.outBranch != null) {
            var branch = block.outBranch;
            if (branch.isCond) {
                if (branch.paths[0].cond == BranchPath.COND_RANDOM) {
                    printLn("{");
                    indent();
                        printLn("int r = rand()%4;");
                        for (var i = 0; i < branch.paths.length; ++i) {
                            var path = branch.paths[i];
                            printLn("if (r == " + i + ") {");
                            indent();
                                printLn("block_" + path.block.id + "();");
                                printLn("return;");
                            dedent();
                            printLn("}");
                        }
                    dedent();
                    printLn("}");
                } else {
                    for (var i = 0; i < branch.paths.length; ++i) {
                        var path = branch.paths[i];
                        var condStr = "";
                        if (path.cond == BranchPath.COND_NEQ_ZERO)
                            condStr = "!= 0";
                        else if (path.cond == BranchPath.COND_EQ_ZERO)
                            condStr = "== 0";
                        else
                            throw "unsupported path condition type";

                        printLn("if (top() " + condStr + ") {");
                        indent();
                            pop();
                            printLn("block_" + path.block.id.toString() + "();");
                            printLn("return;")
                        dedent();
                        printLn("}");
                    }
                }
            } else {
                printLn("block_" + branch.paths[0].block.id.toString() + "();");
            }
        }

        dedent();
        printLn("}");
    }

    this.gen = function() {
        this.text = "";

        var programStart = 0;
        for (var i = 0; i < blocks.length; ++i) {
            if (blocks[i].isProgramStart) {
                programStart = blocks[i].id;
                break;
            }
        }

        printLn("#include <stdio.h>");
        printLn("#include <stdlib.h>");
        printLn("");
        printLn("#define W 80");
        printLn("#define H 25");
        printLn("#define MAX_STACK 65535");
        printLn("static char mem[W][H] = {");
        indent();
            var sepX = "";
            var sepY = "";
            for (var x = 0; x < Befunge.WIDTH; ++x) {
                var s = "{";
                sepY = "";
                for (var y = 0; y < Befunge.HEIGHT; ++y) {
                    var code = this.prog.cell(new Vec2(x, y)).charCodeAt(0);
                    s += sepY + code;
                    sepY = ", ";
                }
                s += "}";
                printLn(sepX + s);
                sepX = ",";
            }
        dedent();
        printLn("};");
        printLn("static int stackSize;");
        printLn("static int stack[MAX_STACK];");
        printLn("");
        printLn("void pop(void) {");
        printLn("if (stackSize > 0)");
        indent();
            printLn("--stackSize;");
        dedent();
        printLn("}");
        printLn("");
        printLn("int top(void) {");
        indent();
            printLn("if (stackSize > 0) return stack[stackSize - 1];");
            printLn("else return 0;");
        dedent();
        printLn("}");
        printLn("");
        printLn("int snd(void) {");
        indent();
            printLn("if (stackSize > 1) return stack[stackSize - 2];");
            printLn("else return 0;");
        dedent();
        printLn("}");
        printLn("");
        printLn("int thd(void) {");
        indent();
            printLn("if (stackSize > 2) return stack[stackSize - 3];");
            printLn("else return 0;");
        dedent();
        printLn("}");
        printLn("");
        printLn("int push(int val) {");
        indent();
            printLn("if (stackSize < MAX_STACK)");
            indent();
                printLn("stack[stackSize++] = val;");
            dedent();
        dedent();
        printLn("}");
        printLn("");

        for (var i = 0; i < blocks.length; ++i) {
            var block = blocks[i];
            printLn("void block_" + block.id + "();");
        }
        printLn("");

        printLn("int main(void) {");
        indent();
            printLn("block_" + programStart + "();");
            printLn("return 0;");
        dedent();
        printLn("}");

        for (var i = 0; i < blocks.length; ++i) {
            var block = blocks[i];

            genBlock(block, block.id);
        }

        return this.text;
    }
}

function hideAllScreens() {
    document.getElementById("input_screen").style.display = "none";
    document.getElementById("working_screen").style.display = "none";
    document.getElementById("analysis_screen").style.display = "none";
    document.getElementById("code_screen").style.display = "none";
}

function showInputScreen() {
    hideAllScreens();
    document.getElementById("input_screen").style.display = "block";
}

function showWorkingScreen() {
    hideAllScreens();
    var working_screen = document.getElementById("working_screen");
    working_screen.style.display = "block";
}

function showAnalysisScreen() {
    hideAllScreens();
    document.getElementById("analysis_screen").style.display = "block";
}

function showCodeScreen() {
    hideAllScreens();
    document.getElementById("code_screen").style.display = "block";
}

var analyzer = null;

document.getElementById("analyze").addEventListener(
    "click",
    function(e) {
        var prog = prog_editor.getValue();
        showAnalysisScreen();
        setTimeout(function() {
            analyzer = new Analyzer(prog);
            var visualizer = new Visualizer(analyzer);
            analyzer.analyze();
            visualizer.visualize(document.getElementById("network"));

            document.getElementById("stats_bb_count").innerText
                = analyzer.blocks().length;
        }, 1);
    }
);

var backToAnalysis = document.getElementsByName("back_to_analysis");
for (var i = 0; i < backToAnalysis.length; ++i) {
    backToAnalysis[i].addEventListener(
        "click",
        function(e) {
            showAnalysisScreen();
        }
    );
}

document.getElementById("edit").addEventListener(
    "click",
    function(e) {
        showInputScreen();
    }
);

document.getElementById("generate_c").addEventListener(
    "click",
    function(e) {
        showCodeScreen();
        setTimeout(function() {
            var codeGen = new CodeGeneratorC(analyzer.blocks(), analyzer.prog());
            generated_c_editor.setValue(codeGen.gen());
        }, 1);
    }
);

var exampleDescs = {
    helloworld: "\"Helloo world!\" from "
        + "<a href=\"https://esolangs.org/wiki/Befunge#Hello.2C_world.21\">Esolang</a>",
    factorial: "Factorial program from "
        + "<a href=\"https://esolangs.org/wiki/Befunge#Factorial\">Esolang</a>",
    sieve: "Sieve of Eratosthenes from "
        + "<a href=\"https://esolangs.org/wiki/Befunge#Sieve_of_Eratosthenes\">Esolang</a>",
    guess: "Simple game (\"Less or More\") from "
        + "<a href=\"https://esolangs.org/wiki/Befunge#Simple_game_.28.22Less_or_More.22.29\">Esolang</a>",
    chess: "An amazing chess program by "
        + "<a href=\"http://frox25.no-ip.org/~mtve/code/eso/bef/chess/\">mtve</a>",
    wumpus: "Befunge-93 port of Hunt the Wumpus by "
        + "<a href=\"http://wimrijnders.nl/other/befunge.html\">Wim Rijnders</a>."
        + " Most complex Befunge-93 program yet?"
};

var exampleList = [
    "helloworld", "factorial", "sieve", "guess", "chess", "wumpus"
];

function initExamples() {
    var examples = exampleList;
    var list = document.getElementById("example_list");

    var sep = "";
    for (var i = 0; i < examples.length; ++i) {
        var f = function() {
            var example = examples[i];
            var exampleElem = document.getElementById(example);
            var anchor = document.createElement("a");
            var text = document.createTextNode(example);
            anchor.appendChild(text);
            anchor.title = example;
            anchor.addEventListener(
                "click",
                function(e) {
                    var prog = exampleElem.innerText;
                    prog_editor.setValue(prog);
                    var desc = document.getElementById("example_desc");

                    desc.innerHTML = exampleDescs[example];

                    e.preventDefault();
                }
            );
            anchor.className = "button";
            list.appendChild(anchor);
        };
        f();
    }
}

initExamples();
showInputScreen();
