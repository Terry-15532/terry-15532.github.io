function $(id) {
    return document.getElementById(id);
}

function switchToPortfolio() {
    SwitchPage("portfolio.html", "My Portfolio");
}

function switchToAbout() {
    // window.location.href = "index.html";
    SwitchPage("about.html", "About Me");
    // ChangeHeader("About Me");
}

function setElm(id, name) {
    $(id).innerHTML = name;
}

function AddHeader() {
    fetch("header.html")
        .then(response => response.text())
        .then(data => {
            setElm("header", data);
            SwitchPage("about.html", "About Me");
        }
        );
}

var currHeader = "";

function ChangeHeader(header) {
    var h = $(header);
    setElm("headerTitle", header);
    // h.setAttribute("onClick", "");
    // h.setAttribute("style", "color: white; transition: text-shadow 300ms; float: right; pointer-events: none;");
    // data => data.text()).then(
    // data => {
    // h.setAttribute("style", "color: white; transition: text-shadow 300ms; float: right; pointer-events: none; text-shadow: 0px 0px 20px rgb(0, 233, 255);");
    // }
    // );
    dispLine(header + "_Line");
    h.style.pointerEvents = "none";
    h.style.textShadow = "0px 0px 20px rgb(0, 233, 255)";
    let tmp = currHeader;
    currHeader = header;
    hideLine(tmp + "_Line");
    $(tmp).style = "transition: text-shadow 300ms;";
}

// var currBody = 1;

function SwitchPage(filename, header) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            // document.scrollTop = 0;
            // document.documentElement.setAttribute("style", "transition: all 500ms; scrollTop: 0px;");
            document.documentElement.scrollTop = 0;
            setElm("Body", data);
            // if (currBody == 2) {
            //     currBody = 1;
            //     // data.getElementById("Body_1").setAttribute("id", "Body_2");
            //     $("Body_2").setAttribute("style", "position: absolute; margin-right: 100%; transition: all 500ms;");
            //     $("Body_1").setAttribute("style", "position: absolute; margin-right: 0px; transition: all 500ms;");
            // }
            // else if (currBody == 1) {
            //     currBody = 2;
            //     // data.getElementById("Body_1").setAttribute("id", "Body_2");
            //     setElm("Body_1", data);
            //     $("Body_1").setAttribute("style", "position: absolute; margin-right: 100%; transition: all 500ms;");
            //     $("Body_2").setAttribute("style", "position: absolute; margin-right: 0px; transition: all 500ms;");
            // }
            // if (currBody == 1) {
            //     currBody = 2;
            //     // data.getElementById("Body_2").setAttribute("id", "Body_1");
            //     setElm("Body_1", data);
            //     $("Body_1").setAttribute("style", "margin-right: 100%;");
            //     $("Body_2").setAttribute("style", "margin:0px;");
            // }
        })
    ChangeHeader(header);
}

function dispLine(id) {
    let e = $(id);
    e.style.height = "35px";
    e.style.marginTop = "10px";

}

function hideLine(id) {
    if (currHeader + "_Line" != id) {
        let e = $(id);
        e.style.height = "0px";
        e.style.marginTop = "22.5px";
    }
}