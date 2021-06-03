class Vec2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
  }

  _mod(x, m) {
    x %= m;
    if (x < 0)
      x += m;
    return x;
  }

  mod(other) {
    this.x = this._mod(this.x, other.x);
    this.y = this._mod(this.y, other.y);
  }

  equal(other) {
    return (other.x == this.x) && (other.y == this.y);
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  toString() {
    return "(" + this.x.toString() + ", " + this.y.toString() + ")";
  }
}

class PC {
  constructor(pos, dir, quoting) {
    this.pos = pos;
    this.dir = dir;
    this.quoting = quoting;
  }

  advance() {
    this.pos.add(this.dir)
    this.pos.mod(Befunge.DIMENSIONS);
  }

  clone() {
    return new PC(this.pos.clone(), this.dir.clone(), this.quoting);
  }

  toString() {
    return "(" +
      this.pos.toString() +
      ", " + this.dir.toString() +
      ", " + this.quoting.toString() +
      ")";
  }
}

class StackEntry {
  constructor(type, val) {
    this.type = type;
    this.val = val;
  }
}

class Ctx {
  constructor(pc, block) {
    this.pc = pc;
    this.block = block;
  }
}

class Befunge {
  static WIDTH = 80;
  static HEIGHT = 25;
  static DIMENSIONS = new Vec2(Befunge.WIDTH, Befunge.HEIGHT);

  constructor() {
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
  }

  static zeroDir(char) {
    if (char == "_") return new Vec2(1, 0);
    if (char == "|") return new Vec2(0, 1);
    throw "bad conditional branch instruction"
  };

  static branchCondFromDir(char, dir) {
    if ((char == "_") || (char == "|")) {
      if (Befunge.zeroDir(char).equal(dir))
        return BranchPath.COND_EQ_ZERO;
      return BranchPath.COND_NEQ_ZERO;
    }
    if (char == "?")
      return BranchPath.COND_RANDOM;
    throw "bad conditional branch instruction"
  };

  static uncondBranchDir(c) {
    if (c == "<") return new Vec2(-1, 0);
    if (c == ">") return new Vec2(1, 0);
    if (c == "^") return new Vec2(0, -1);
    if (c == "v") return new Vec2(0, 1);
    throw "bad unconditional branch instruction"
  }

  static condBranchDirs(c) {
    if (c == "_") return new Array(new Vec2(-1, 0), new Vec2(1, 0));
    if (c == "|") return new Array(new Vec2(0, -1), new Vec2(0, 1));
    if (c == "?") return new Array(
      new Vec2(0, -1), new Vec2(0, 1),
      new Vec2(-1, 0), new Vec2(1, 0)
    );
    throw "bad conditional branch instruction"
  }

  insType(c) {
    return this.map[c];
  }
}

class Prog {
  constructor(progtext) {
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
  }

  cell(vec) {
    var wrapVec = vec.clone();
    wrapVec.mod(Befunge.DIMENSIONS)
    return this.prog[wrapVec.x][wrapVec.y];
  }
}

class BranchPath {
  constructor(isCond, block) {
    this.isCond = isCond;
    this.block = block;
  }

  static COND_EQ_ZERO = 0;
  static COND_NEQ_ZERO = 1;
  static COND_RANDOM = 2;

  static condToString(cond) {
    if (cond == BranchPath.COND_EQ_ZERO) return "=0";
    if (cond == BranchPath.COND_NEQ_ZERO) return "!=0";
    if (cond == BranchPath.COND_RANDOM) return "(random)";
    throw "unknown condition";
  }

  toString() {
    var s = "#" + this.block.id.toString();
    if (isCond)
      s += "[" + BranchPath.condToString(this.cond) + "]";
    return s;
  }
}

class Branch {
  constructor(isCond) {
    this.isCond = isCond;
    this.paths = new Array();
  }

  toString() {
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

class PseudoInsString {
  constructor() {
    this.string = "";
  }

  accumulate(c) {
    this.string += c;
  }

  toString() {
    return "\"" + this.string + "\"";
  }
}

class Block {
  constructor(id) {
    this.id = id;
    this.linearIns = new Array();
    this.indexToLinear = new Array();
    this.isProgramStart = false;
    this.outBranch = null;
  }

  isNop() {
    return ((this.outBranch != null) &&
      (this.linearIns.length == 0) &&
      (!this.outBranch.isCond));
  }

  _outBranchToString() {
    if (this.outBranch == null)
      return "(null)\n";
    return this.outBranch.toString()
  }

  toString() {
    var s = "BLOCK #" + this.id.toString() + " {\n";
    s += "\tprogram start? " + this.isProgramStart + "\n";
    s += "\tlinear instructions: ";
    for (var i = 0; i < this.linearIns.length; ++i) {
      s += this.linearIns[i];
    }
    s += "\n";
    s += "\tout branch: " + _outBranchToString();
    s += "}\n";
    return s;
  }
}

class Analyzer {
  constructor(progtext) {
    this.mProg = new Prog(progtext);
    this.befunge = new Befunge();

    this.nextBlockId = 1;

    var startBlock = this._createBlock();
    startBlock.isProgramStart = true;
    this.blockList = new Array(startBlock);
    this.blockMap = new Array();

    this.ctxs = new Array(
      new Ctx(
        new PC(new Vec2(0, 0), new Vec2(1, 0), false),
        this.blockList[0]
      )
    );
  }

  _createBlock() {
    return new Block(this.nextBlockId++);
  }

  _updateBranch(branch, from, to) {
    if (branch == null)
      return;

    for (var i = 0; i < branch.paths.length; ++i) {
      if (branch.paths[i].block.id == from.id)
        branch.paths[i].block = to;
    }
  }

  _splitBlock(victim, index) {
    var headBlock = this._createBlock(); /* victim becomes tail block */
    headBlock.outBranch = new Branch(false);
    headBlock.outBranch.paths.push(new BranchPath(false, victim));

    headBlock.linearIns = victim.linearIns.slice(0, index);
    victim.linearIns = victim.linearIns.slice(index);

    for (var i = 0; i < this.blockList.length; ++i) {
      this._updateBranch(
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

  _assignLinearIndex(block, pc, off) {
    var linearIndex = block.linearIns.length + off;
    block.indexToLinear[pc.toString()] = linearIndex;
  }

  calcBasicBlocks() {
    var handleCondBranch = (char, pc, block) => {
      var dirs = Befunge.condBranchDirs(char);
      block.outBranch = new Branch(true);
      for (var i = 0; i < dirs.length; ++i) {
        var dir = dirs[i];
        var newPC = pc.clone();
        newPC.dir = dir;
        newPC.advance();
        var newBlock = this._createBlock();
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
            this._updateBranch(updateBlock.outBranch,
              block, nextBlock);
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
          this._splitBlock(victim, index);
        block.outBranch = new Branch(false);
        block.outBranch.paths.push(new BranchPath(false, victim));
        continue;
      }
      blockMap[pc.toString()] = block;

      var char = this.mProg.cell(pc.pos);
      var insType = this.befunge.insType(char);

      //console.log(pc.toString() + ": " + char + " (" + insType + ")");

      if (pc.quoting) {
        if (insType == "quote") {
          this._assignLinearIndex(block, pc, -1);
          pc.quoting = false;
          pc.advance();
          this.ctxs.push(ctx);
        } else {
          this._assignLinearIndex(block, pc, -1);
          block.linearIns[block.linearIns.length - 1].accumulate(char);
          pc.advance();
          this.ctxs.push(ctx);
        }
      } else if (insType == "quote") {
        this._assignLinearIndex(block, pc, 0);
        pc.quoting = true;
        block.linearIns.push(new PseudoInsString());
        pc.advance();
        this.ctxs.push(ctx);
      } else if (insType == "cond_branch") {
        this._assignLinearIndex(block, pc, 0);
        handleCondBranch(char, pc, block);
      } else if (insType == "uncond_branch") {
        this._assignLinearIndex(block, pc, 0);
        pc.dir = Befunge.uncondBranchDir(char);
        pc.advance();
        this.ctxs.push(ctx);
      } else if (insType == "skip") {
        this._assignLinearIndex(block, pc, 0);
        pc.advance();
        pc.advance();
        this.ctxs.push(ctx);
      } else {
        if (insType == "space") {
          this._assignLinearIndex(block, pc, 0);
        } else {
          this._assignLinearIndex(block, pc, 0);
          block.linearIns.push(char);
        }
        pc.advance();
        if (insType != "terminate")
          this.ctxs.push(ctx);
      }
    }

    elimEmptyBlocks();
  }

  analyze() {
    this.calcBasicBlocks();
  }

  blocks() {
    return this.blockList;
  }

  prog() {
    return this.mProg;
  }
}

class Visualizer {
  constructor(analyzer) {
    this.analyzer = analyzer;
  }

  visualize(div) {
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
        id: block.id,
        label: label,
        shape: "box"
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
    var data = {
      nodes: nodes,
      edges: edges
    };
    var options = {};
    var network = new vis.Network(div, data, options);
  }
}

class CodeGeneratorC {
  constructor(blocks, prog) {
    this.blocks = blocks;
    this.text = "";
    this.tabLevel = 0;
    this.prog = prog;
  }

  _printLn(line) {
    for (var i = 0; i < this.tabLevel; ++i)
      this.text += "    ";
    this.text += line;
    this.text += "\n";
  }

  _indent() {
    ++this.tabLevel;
  }

  _dedent() {
    --this.tabLevel;
  }

  _push(exp) {
    this._printLn("push(" + exp + ");");
  }

  _pop() {
    this._printLn("pop();");
  }

  _binaryOp(op) {
    this._printLn("{");
    this._indent();
    this._printLn("int a = top(), b = snd();");
    this._pop();
    this._pop();
    this._push("b " + op + " a");
    this._dedent();
    this._printLn("}");
  }

  _genInstruction(ins) {
    if (ins == "$") {
      this._pop();
    } else if (ins == ":") {
      this._push("top()")
    } else if (ins == "\\") {
      this._printLn("{");
      this._indent();
      this._printLn("int t = top();")
      this._printLn("int s = snd();")
      this._pop();
      this._pop();
      this._push("t");
      this._push("s");
      this._dedent();
      this._printLn("}");
    } else if (ins == "@") {
      this._printLn("exit(0);")
    } else if (ins == ".") {
      this._printLn("printf(\"%d \", top());");
      this._pop();
    } else if (ins == ",") {
      this._printLn("printf(\"%c\", (char)top());");
      this._pop();
    } else if (ins == "&") {
      this._printLn("{");
      this._indent();
      this._printLn("int v = 0;");
      this._printLn("scanf(\"%d\", &v);");
      this._push("v");
      this._dedent();
      this._printLn("}");
    } else if (ins == "~") {
      this._printLn("{");
      this._indent();
      this._printLn("char v = 0;");
      this._printLn("scanf(\"%c\", &v);");
      this._push("v");
      this._dedent();
      this._printLn("}");
    } else if (ins == "g") {
      this._printLn("{");
      this._indent();
      this._printLn("int x = ((snd() % W) + W) % W;");
      this._printLn("int y = ((top() % H) + H) % H;");
      this._pop();
      this._pop();
      this._push("mem[x][y]");
      this._dedent();
      this._printLn("}");
    } else if (ins == "p") {
      this._printLn("{");
      this._indent();
      this._printLn("int v = thd();");
      this._printLn("int x = ((snd() % W) + W) % W;");
      this._printLn("int y = ((top() % H) + H) % H;");
      this._pop();
      this._pop();
      this._pop();
      this._printLn("mem[x][y] = v;");
      this._dedent();
      this._printLn("}");
    } else if (ins == "!") {
      this._printLn("{");
      this._indent();
      this._printLn("int v = top();");
      this._pop();
      this._printLn("if (v == 0) push(1);");
      this._printLn("else push(0);")
      this._dedent();
      this._printLn("}");
    } else if (ins == "-") {
      this._binaryOp("-");
    } else if (ins == "+") {
      this._binaryOp("+");
    } else if (ins == "*") {
      this._binaryOp("*");
    } else if (ins == "/") {
      this._binaryOp("/");
    } else if (ins == "%") {
      this._binaryOp("%");
    } else if (ins == "`") {
      this._printLn("{");
      this._indent();
      this._printLn("int a = top(), b = snd();");
      this._pop();
      this._pop();
      this._printLn("if (b > a) push(1);");
      this._printLn("else push(0);");
      this._printLn("}");
      this._dedent();
    } else if (typeof ins == "string") {
      var code = ins.charCodeAt(0);
      if ((code >= "0".charCodeAt(0)) && (code <= "9".charCodeAt(0))) {
        var val = code - "0".charCodeAt(0);
        this._push(val.toString());
      } else {
        throw ("unknown instruction: " + ins);
      }
    } else if (typeof ins == "object") {
      /* pseudo-instruction */
      if (ins instanceof PseudoInsString) {
        this._printLn("{");
        this._indent();
        this._printLn("char *string = \"" + ins.string + "\";");
        var len = ins.string.length.toString();
        this._printLn("for (int i = 0; i < " + len + "; ++i) {");
        this._indent();
        this._push("string[i]");
        this._dedent();
        this._printLn("}");
        this._dedent();
        this._printLn("}");
      } else {
        throw "unrecognized pseudo-instruction";
      }
    } else {
      this._printLn("/* unknown instruction */");
    }
  }

  _genBlock(block, id) {
    this._printLn("void block_" + id + "(void) {");
    this._indent();

    for (var i = 0; i < block.linearIns.length; ++i) {
      this._genInstruction(block.linearIns[i]);
    }

    if (block.outBranch != null) {
      var branch = block.outBranch;
      if (branch.isCond) {
        if (branch.paths[0].cond == BranchPath.COND_RANDOM) {
          this._printLn("{");
          this._indent();
          this._printLn("int r = rand()%4;");
          for (var i = 0; i < branch.paths.length; ++i) {
            var path = branch.paths[i];
            this._printLn("if (r == " + i + ") {");
            this._indent();
            this._printLn("block_" + path.block.id + "();");
            this._printLn("return;");
            this._dedent();
            this._printLn("}");
          }
          this._dedent();
          this._printLn("}");
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

            this._printLn("if (top() " + condStr + ") {");
            this._indent();
            this._pop();
            this._printLn("block_" + path.block.id.toString() + "();");
            this._printLn("return;")
            this._dedent();
            this._printLn("}");
          }
        }
      } else {
        this._printLn("block_" + branch.paths[0].block.id.toString() + "();");
      }
    }

    this._dedent();
    this._printLn("}");
  }

  gen() {
    this.text = "";

    var programStart = 0;
    for (var i = 0; i < this.blocks.length; ++i) {
      if (this.blocks[i].isProgramStart) {
        programStart = this.blocks[i].id;
        break;
      }
    }

    this._printLn("#include <stdio.h>");
    this._printLn("#include <stdlib.h>");
    this._printLn("");
    this._printLn("#define W 80");
    this._printLn("#define H 25");
    this._printLn("#define MAX_STACK 65535");
    this._printLn("static char mem[W][H] = {");
    this._indent();
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
      this._printLn(sepX + s);
      sepX = ",";
    }
    this._dedent();
    this._printLn("};");
    this._printLn("static int stackSize;");
    this._printLn("static int stack[MAX_STACK];");
    this._printLn("");
    this._printLn("void pop(void) {");
    this._printLn("if (stackSize > 0)");
    this._indent();
    this._printLn("--stackSize;");
    this._dedent();
    this._printLn("}");
    this._printLn("");
    this._printLn("int top(void) {");
    this._indent();
    this._printLn("if (stackSize > 0) return stack[stackSize - 1];");
    this._printLn("else return 0;");
    this._dedent();
    this._printLn("}");
    this._printLn("");
    this._printLn("int snd(void) {");
    this._indent();
    this._printLn("if (stackSize > 1) return stack[stackSize - 2];");
    this._printLn("else return 0;");
    this._dedent();
    this._printLn("}");
    this._printLn("");
    this._printLn("int thd(void) {");
    this._indent();
    this._printLn("if (stackSize > 2) return stack[stackSize - 3];");
    this._printLn("else return 0;");
    this._dedent();
    this._printLn("}");
    this._printLn("");
    this._printLn("int push(int val) {");
    this._indent();
    this._printLn("if (stackSize < MAX_STACK)");
    this._indent();
    this._printLn("stack[stackSize++] = val;");
    this._dedent();
    this._dedent();
    this._printLn("}");
    this._printLn("");

    for (var i = 0; i < this.blocks.length; ++i) {
      var block = this.blocks[i];
      this._printLn("void block_" + block.id + "();");
    }
    this._printLn("");

    this._printLn("int main(void) {");
    this._indent();
    this._printLn("block_" + programStart + "();");
    this._printLn("return 0;");
    this._dedent();
    this._printLn("}");

    for (var i = 0; i < this.blocks.length; ++i) {
      var block = this.blocks[i];

      this._genBlock(block, block.id);
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

      document.getElementById("stats_bb_count").innerText = analyzer.blocks().length;
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
  helloworld: "\"Helloo world!\" from " +
    "<a href=\"https://esolangs.org/wiki/Befunge#Hello.2C_world.21\">Esolang</a>",
  factorial: "Factorial program from " +
    "<a href=\"https://esolangs.org/wiki/Befunge#Factorial\">Esolang</a>",
  sieve: "Sieve of Eratosthenes from " +
    "<a href=\"https://esolangs.org/wiki/Befunge#Sieve_of_Eratosthenes\">Esolang</a>",
  guess: "Simple game (\"Less or More\") from " +
    "<a href=\"https://esolangs.org/wiki/Befunge#Simple_game_.28.22Less_or_More.22.29\">Esolang</a>",
  chess: "An amazing chess program by " +
    "<a href=\"http://frox25.no-ip.org/~mtve/code/eso/bef/chess/\">mtve</a>",
  wumpus: "Befunge-93 port of Hunt the Wumpus by " +
    "<a href=\"http://wimrijnders.nl/other/befunge.html\">Wim Rijnders</a>." +
    " Most complex Befunge-93 program yet?"
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