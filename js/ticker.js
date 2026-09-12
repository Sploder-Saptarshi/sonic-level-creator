var xmlhttpNews = new Array();
var tickerText = new Array();

function changeTitle (whichDiv, theTitle) {
    document.getElementById (whichDiv).innerHTML = theTitle;
}

function getTicker (whichDiv, total, whichStyle, types, userid, onlyuniques) {
    tickerText[whichDiv] = document.getElementById (whichDiv);

    xmlhttpNews[whichDiv] = false;
    try {xmlhttpNews[whichDiv] = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttpNews[whichDiv] = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttpNews[whichDiv] = false;}}
    if (!xmlhttpNews[whichDiv] && typeof XMLHttpRequest != 'undefined') xmlhttpNews[whichDiv] = new XMLHttpRequest ();

    xmlhttpNews[whichDiv].open ('GET', HTML_TOP + 'ajax/ticker.php?total=' + total + '&whichStyle=' + whichStyle + '&types=' + types + '&userid=' + userid + '&onlyuniques=' + onlyuniques, true);
    xmlhttpNews[whichDiv].onreadystatechange = function () {
        switch (xmlhttpNews[whichDiv].readyState) {
            case 1 : case 2 : case 3 :
                tickerText[whichDiv].innerHTML = '<div class="ajax-loader">&nbsp;</div>';
            break;
            case 4 :
                returnHTML = '';
                resultXML = xmlhttpNews[whichDiv].responseXML;

                result = resultXML.getElementsByTagName ("result");
                count = result[0].getAttribute("count");
                items = result[0].getElementsByTagName ("item");

                for (x = 0; x < items.length; x++) {
                    //returnHTML += items[x].getAttribute("userid");
                    //alert (items[x]);
                    //for each (asd in items[x]) returnHTML += asd + '<br />';
                    returnHTML += items[x].firstChild.nodeValue;
                }

                tickerText[whichDiv].innerHTML = returnHTML;
                break;
        }
    }

    xmlhttpNews[whichDiv].send (null);

    return;
}

var newsExpanded = false;
var newsOptions;

function collapseTicker (whichOne) {
    switch (whichOne) {
        case 'news' :
            newsExpanded = false;
            newsOptions.morph('.middleInactiveThree');
        break;
    }
}

function expandTicker (whichOne) {
    switch (whichOne) {
        case 'news' :
            newsExpanded = true;
            newsOptions.morph('.middleActiveThree');
        break;
    }
}
