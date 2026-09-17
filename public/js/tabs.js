/*
    All code written by Mark Hinch - Feb to May 2008
     - modified by Kai Price <pricek@soe.sega.co.uk> (August 2008)
*/

var allTabs         = new Array ();    // Holds all tabs' info and queries etc...
var selectedTabs    = new Array ();    // Holds the tabNumber of the active tab of each tabset

/**
 * initiaties a tab
 *
 * @param   string      identifier of the tabset that is to be instanciated
 * @access  public
 */
function createTabSet (whichTabs) {
    selectedTabs[whichTabs] = new Array ();
    allTabs[whichTabs]      = new Array ();
}

/**
 * defines a tab that is to be displayed
 *
 * @param   string      identifier of the tabset that is to be populated
 * @param   string      heading of the tab
 * @param   string      identifies the js case that should be used to reneder results
 * @param   string      identifies the ajax query that should be used
 * @param   string[]    the paramaters names that are to be passed into the ajax query string
 * @param   string[]    the values that correspond to the parameter names
 * @param   int         the number of results that should be displayed
 * @access  public
 */
function defineTab (whichTabs, theHeading, theFunction, theQuery, theParams, theValues, theCount) {
    var tabNumber                                   = allTabs[whichTabs].length;
    allTabs[whichTabs][tabNumber]                   = new Array ();
    allTabs[whichTabs][tabNumber]["theHeading"]     = theHeading;
    allTabs[whichTabs][tabNumber]["theFunction"]    = theFunction;
    allTabs[whichTabs][tabNumber]["theQuery"]       = theQuery;
    allTabs[whichTabs][tabNumber]["theParams"]      = theParams;
    allTabs[whichTabs][tabNumber]["theValues"]      = theValues;
    allTabs[whichTabs][tabNumber]["theCount"]       = theCount;
}

/**
 * re-defines a tab that is to be displayed
 *
 * @param   string      identifier of the tabset that is to be populated
 * @param   string      heading of the tab
 * @param   string      identifies the js case that should be used to reneder results
 * @param   string      identifies the ajax query that should be used
 * @param   string[]    the paramaters names that are to be passed into the ajax query string
 * @param   string[]    the values that correspond to the parameter names
 * @access  public
 */
function redefineTab (whichTabs, tabNumber, theParams, theValues) {
    allTabs[whichTabs][tabNumber]["theParams"] = theParams;
    allTabs[whichTabs][tabNumber]["theValues"] = theValues;

    drawTabs (whichTabs, tabNumber);
}

/**
 * renders the tab
 *
 * @param   string      identifier of the tabs
 * @param   int         which tab, as part of the tabset, that should be rendered
 * @access  public
*/
function drawTabs (whichTabs, tabNumber) {
	var theTabs = '<table class="tabSectionHeading" cellpadding="0" cellspacing="0">';
	theTabs    += '<tr>';

	for (x = 0; x < allTabs[whichTabs].length; x++) {
	    //determine whether the heading is to be rendered as selected or not
		var tabButton = HTML_TOP + 'images/tabsbuttons/' + ((x == tabNumber) ? allTabs[whichTabs][x]["theHeading"] + '_active.gif' : allTabs[whichTabs][x]["theHeading"] + '_nor.gif');
		//mouseover image
        var mouseover = HTML_TOP + 'images/tabsbuttons/' + allTabs[whichTabs][x]["theHeading"] + '_ro.gif'
        //mouseout image
        var mouseout = HTML_TOP + 'images/tabsbuttons/' + allTabs[whichTabs][x]["theHeading"] + '_nor.gif'

		//write out the code for the tab heading
		theTabs += '<td><div style="float: left">';

		if(x != tabNumber) {
		  theTabs += '<a class="tabLink" href="javascript:void(0);" onclick="javascript:drawTabs (\'' + whichTabs + '\', ' + x + ')"';
		  theTabs += ' onmouseover="document.getElementById(\'' + allTabs[whichTabs][x]["theHeading"] + '\').src=\'' + mouseover + '\'"';
		  theTabs += ' onmouseout="document.getElementById(\'' + allTabs[whichTabs][x]["theHeading"] + '\').src=\'' + mouseout + '\'">';

		}

		theTabs += '<img id="' + allTabs[whichTabs][x]["theHeading"] + '"src="' +  tabButton + '" alt="" \/>';

		theTabs += (x != tabNumber) ? '<\/a>' : '';
		theTabs += '</div></td>';
	}
	theTabs += '</tr></table>';

	document.getElementById ('tabs_' + whichTabs).innerHTML = theTabs;                                             // update the html

    selectedTabs[whichTabs] = tabNumber;
	populateTabs (whichTabs, tabNumber);                                                                           //add content to the tab that is being rendered
}

/**
 * populates the tab
 *
 * @param   string  indentifier for the tabs
 * @param   int     the tab that is being rendered
 * @access  public
 */
function populateTabs (whichTabs, tabNumber) {
    theQuery  = allTabs[whichTabs][tabNumber]["theQuery"];      //local copy of the query
    theParams = allTabs[whichTabs][tabNumber]["theParams"];     //local copy of the paramater names that are being passed into the query
    theValues = allTabs[whichTabs][tabNumber]["theValues"];     //local copy of values that correspond to the paramater names

    // Sort it out for the relevant browser
    var xmlhttp = false;
    try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {
        try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {
            xmlhttp = false;
        }
    }
    if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

    // Build up the parameters string from passed in parameters and values
    var paramString = '';
    for (z = 0; z < theParams.length; z++) paramString += '&' + theParams[z] + '=' + theValues[z];

    // Perform the query
    //alert(HTML_TOP + 'ajax/ajax-query.php?query=' + theQuery + paramString);
    xmlhttp.open ('GET', HTML_TOP + 'ajax/ajax-query.php?query=' + theQuery + paramString, true);

    // 0 - Not initialised, 1 - Loading data, 2 - Loaded data, 3 - Data available, 4 - Initialised
    xmlhttp.onreadystatechange = function () {
        switch (xmlhttp.readyState) {
            case 0 : case 1 : case 2 : case 3 : displayLoading (whichTabs); break;
            case 4 :
                // Now display the results
                displayResults (whichTabs, xmlhttp.responseXML);
            break;
        }
    }

    xmlhttp.send (null);
    return;
}

/**
 * displays the ajax loading icon in the tabs
 *
 * @access  public
*/
function displayLoading (whichTabs) {
    whichTabs = document.getElementById ('content_' + whichTabs);
    whichTabs.innerHTML = '<div class="ajaxloader" style="background: url(\'' + HTML_TOP + 'images/ajax-loader.gif\') no-repeat center;">&nbsp;<\/div>';
}


/**
 * displays the results that are fetched using the ajax query
 *
 * @param   string  indentifier for the tabs
 * @param   xml     response XML from the ajax query
 * @access  public
 */
function displayResults (whichTabs, resultXML) {
    // CHECK THE COUNT (FOR PAGINATION PURPOSES)
    result = resultXML.getElementsByTagName("result");
    allTabs[whichTabs][selectedTabs[whichTabs]]["theCount"] = result[0].getAttribute("count");
    theFunction = allTabs[whichTabs][selectedTabs[whichTabs]]["theFunction"];

    itemArray = resultXML.getElementsByTagName ('item');

    var resultHTML = '';

    // LET'S SEE IF WE NEED TO HIDE ANY PAGINATION ARROWS
    leftArrow = document.getElementById ('left_' + whichTabs);
    rightArrow = document.getElementById ('right_' + whichTabs);
    if ((leftArrow) && (rightArrow)) {
        for (x = 0; x < allTabs[whichTabs][selectedTabs[whichTabs]]["theParams"].length; x++) {
            if (allTabs[whichTabs][selectedTabs[whichTabs]]["theParams"][x] == "start") {
                theStart = allTabs[whichTabs][selectedTabs[whichTabs]]["theValues"][x] * 1;
            }
            if (allTabs[whichTabs][selectedTabs[whichTabs]]["theParams"][x] == "limit") {
                theLimit = allTabs[whichTabs][selectedTabs[whichTabs]]["theValues"][x] * 1;
            }
        }
        theCount = allTabs[whichTabs][selectedTabs[whichTabs]]["theCount"] * 1;

        if (theStart == 0) {
            if (theCount < theLimit) {
                leftArrow.style.display = 'none';
                rightArrow.style.display = 'none';
            } else {
                leftArrow.style.display = 'none';
                rightArrow.style.display = 'block';
            }
        } else if ((theStart + theLimit) > (theCount)) {
            leftArrow.style.display = 'block';
            rightArrow.style.display = 'none';
        } else if (theCount < theLimit) {
            leftArrow.style.display = 'none';
            rightArrow.style.display = 'none';
        } else {
            leftArrow.style.display = 'block';
            rightArrow.style.display = 'block';
        }
    }

    // if there are results then determine how we want them to be presented in the tab
    if (result[0].getAttribute("count") == 0) { //no results were returned
        resultHTML += '<div class="errorItem">' + itemArray[0].firstChild.nodeValue + '<\/div>';
        if (document.getElementById ('main_' + whichTabs)) {
            document.getElementById ('main_' + whichTabs).style.display = "none";
        }
    } else {
        switch (theFunction) {
            case "highScoresTabbedSideNav" :
                var count = resultXML.getElementsByTagName("result")[0].getAttribute("count");
                for (i=0;i<count;i++) {
                    var name   = resultXML.getElementsByTagName("username")[i].firstChild.nodeValue;
                    var score  = resultXML.getElementsByTagName("score")[i].firstChild.nodeValue;

                    resultHTML += '<div class="tabbedHighScore">';
                        if(i<=2){ //the top 3 scores are presented different to the other 7 (there are 10 in total)
                            var image  = resultXML.getElementsByTagName("img")[i].firstChild.nodeValue;

                            resultHTML += image;
                            resultHTML += '<div class="content">';
                                var img = '';
                                switch(i){ //determine what medallion to display
                                    case 0:
                                        img = 'highscore-1st.gif';
                                    break;
                                    case 1:
                                        img = 'highscore-2nd.gif';
                                    break;
                                    case 2:
                                        img = 'highscore-3rd.gif';
                                    break;
                                }
                                resultHTML += '<img src="' + HTML_TOP + 'images/' + img + '" alt="" class="award" />';
                                resultHTML += '<div class="clear">&nbsp;</div>';
                                resultHTML += '<div class="nickname">' + name.substr(0, 14) + '</div>';
                                resultHTML += '<div class="score"><strong>score:</strong> ' + score + '</div>';

                            resultHTML += '<\/div>';
                        }else{
                            resultHTML += '<div class="allinoneline">';
                                resultHTML += '<div class="nickname">' + (i+1) + '. ' + name + '<\/div>';
                                resultHTML += '<div class="score">' + score + '<\/div>';
                                resultHTML += '<div class=\"clear\">&nbsp;<\/div>';
                            resultHTML += '<\/div>';
                        }
                    resultHTML += '<div class=\"clear\">&nbsp;<\/div>';
                    resultHTML += '<\/div>';
                }
                break;
            case "blank" :
                resultHTML = '';
            break;
        }
    }

    whichTabs = document.getElementById ('content_' + whichTabs);
    if (resultHTML != '') {
        whichTabs.innerHTML = resultHTML;
    } else {
        whichTabs.innerHTML = "";
    }
}

function skipPage (whichTabs, whichWay) {
    tabNumber = selectedTabs[whichTabs];
    theQuery = allTabs[whichTabs][tabNumber]["theQuery"];
    theParams = allTabs[whichTabs][tabNumber]["theParams"];
    theValues = allTabs[whichTabs][tabNumber]["theValues"];
    theCount = allTabs[whichTabs][tabNumber]["theCount"];

    for (x = 0; x < theParams.length; x++) {
        if (theParams[x] == "start") start = x;
        if (theParams[x] == "limit") limit = x;
    }

    if (whichWay == 'next') {
        theValues[start] = 1 * (theValues[start] * 1) + (theValues[limit] * 1);
    } else if (whichWay == 'prev') {
        theValues[start] = 1 * (theValues[start] * 1) - (theValues[limit] * 1);
    }

    if (((theValues[start] * 1) >= 0) && ((theValues[start] * 1) < theCount)) {
        allTabs[whichTabs][tabNumber]["theValues"] = theValues;
        drawTabs (whichTabs, tabNumber);
    } else {
        if (whichWay == 'next') {
            theValues[start] = 1 * (theValues[start] * 1) - (theValues[limit] * 1);
        } else if (whichWay == 'prev') {
            theValues[start] = 1 * (theValues[start] * 1) + (theValues[limit] * 1);
        }
    }
}

/* This is a function that goes through all the buttons in a range (theButtons), and unhighlights them, whilst highlighting the chosen one (theButton) */
function doButtons (theButtons, theButton) {
    found = true;
    for (x = 0; x < 100; x++) {
        theItem = document.getElementById (theButtons + x);
        if (theItem) {
            if (x == theButton) {
                theItem.setAttribute('class', 'button4_on');
            } else {
                theItem.setAttribute('class', 'button4');
            }
        } else {
            x = 100;
        }
    }
}
