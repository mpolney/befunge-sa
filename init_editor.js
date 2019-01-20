function setup_editor(editor) {
    editor.setOptions({
      fontSize: 12
    });
}

var prog_editor = ace.edit("editor");
prog_editor.setTheme("ace/theme/monokai");
prog_editor.resize();
setup_editor(prog_editor);

var generated_c_editor = ace.edit("generated_c_editor");
generated_c_editor.setTheme("ace/theme/monokai");
generated_c_editor.getSession().setMode("ace/mode/c_cpp");
generated_c_editor.resize();
setup_editor(generated_c_editor);
