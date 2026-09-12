/*
    JS file to get leaderboards and to get certain leaderboard info on the fly
    Written by Mark Hinch for SEGA (January/March 2009)
*/

function addslashes(str) {
    str=str.replace(/\'/g,'\\\'');
    str=str.replace(/\"/g,'\\"');
    str=str.replace(/\\/g,'\\\\');
    str=str.replace(/\0/g,'\\0');
    return str;
}

function stripslashes(str) {
    str=str.replace(/\\'/g,'\'');
    str=str.replace(/\\"/g,'"');
    str=str.replace(/\\\\/g,'\\');
    str=str.replace(/\\0/g,'\0');
    return str;
}

function getLeaderboard (gameid, mode, difficulty, level, timeframe, results) {
    leaderboardArea = document.getElementById ('leaderboard_' + '0');
    if (!mode) mode = document.getElementById('value_mode_' + '0').value;
    if (!difficulty) difficulty = document.getElementById('value_difficulty_' + '0').value;
    if (!level) level = document.getElementById('value_level_' + '0').value;
    if (!timeframe) timeframe = document.getElementById('value_timeframe_' + '0').value;
    if (!results) results = document.getElementById('value_results_' + '0').value;

    document.getElementById('value_mode_' + '0').value = mode;
    document.getElementById('value_difficulty_' + '0').value = difficulty;
    document.getElementById('value_level_' + '0').value = level;

    var xmlhttpLb = false;
    try {xmlhttpLb = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {
        try {xmlhttpLb = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {
            xmlhttpLb = false;
        }
    }
    if (!xmlhttpLb && typeof XMLHttpRequest != 'undefined') xmlhttpLb = new XMLHttpRequest ();

    paramString = '?query=leaderboard';
    paramString += '&gameid=' + gameid;
    paramString += mode > 0 ? '&mode=' + mode : '';
    paramString += difficulty > 0 ? '&difficulty=' + difficulty : '';
    paramString += level > 0 ? '&level=' + level : '';
    paramString += '&timeframe=' + timeframe;
    paramString += '&results=' + results;

    // Do we want to display a simple leaderboard?
    if (document.getElementById('value_simpleleaderboard_' + '0') != null) {
        if (document.getElementById('value_simpleleaderboard_' + '0').value == 'true') {
            paramString += '&simple=true';
        }
    }

    xmlhttpLb.open ('GET', HTML_TOP + 'ajax/leaderboard.php' + paramString, true);
    xmlhttpLb.onreadystatechange = function () {
        switch (xmlhttpLb.readyState) {
            case 1 : case 2 : case 3 : 
                leaderboardArea.innerHTML = '<div class="ajax-loader">&nbsp;</div>';
            break;
            case 4 :
                resultXML = xmlhttpLb.responseXML;
                returnHTML = '';

                result = resultXML.getElementsByTagName ("result");
                games = result[0].getElementsByTagName ('game');
                //returnHTML += '<h1>' + games[0].getAttribute("name") + '</h1>';

                modes = games[0].getElementsByTagName ('mode');

                for (a = 0; a < modes.length; a++) {
                    //returnHTML += '<h2>' + modes[a].getAttribute("name") + '</h2>';
                    difficulties = modes[a].getElementsByTagName ('difficulty');
                    for (b = 0; b < difficulties.length; b++) {
                        //returnHTML += '<h3>' + difficulties[b].getAttribute("name") + '</h3>';
                        levels = difficulties[b].getElementsByTagName ('level');
                        for (c = 0; c < levels.length; c++) {
                            //returnHTML += '<strong>Level ' + levels[c].getAttribute("name") + '</strong>';
                            scores = levels[c].getElementsByTagName ('score');
                            returnHTML += '<div class="scores">';
                            for (d = 0; d < scores.length; d++) {
                                //returnHTML += (d + 1) + ': ' + scores[d].getAttribute("nickname") + ' - ' + scores[d].getAttribute("score") + '<br />';
                                returnHTML += scores[d].firstChild.nodeValue;
                            }
                            returnHTML += '</div>';
                        }
                    }
                }

                leaderboardArea.innerHTML = returnHTML;

                // If this is a simple leaderboard, we wanna update the text in the dropdowns...
                if (document.getElementById('value_simpleleaderboard_' + '0') != null) {
                    if (document.getElementById('value_simpleleaderboard_' + '0').value == 'true') {
                    	changeTitle ('title_mode_' + '0', document.getElementById('value_2_mode_' + '0').value);
                    	changeTitle ('title_difficulty_' + '0', document.getElementById('value_2_difficulty_' + '0').value);
                    	changeTitle ('title_level_' + '0', document.getElementById('value_2_level_' + '0').value);
                    }
                }


                break;
        }
    }

    xmlhttpLb.send (null);
    return;
}

function getLeaderboardInfo (gameid, mode, difficulty, level, timeframe, results) {
    leaderboardInfoArea = document.getElementById ('leaderboard_info_' + '0');
    if (!mode) mode = document.getElementById('value_mode_' + '0').value;
    if (!difficulty) difficulty = document.getElementById('value_difficulty_' + '0').value;
    if (!level) level = document.getElementById('value_level_' + '0').value;
    if (!timeframe) timeframe = document.getElementById('value_timeframe_' + '0').value;
    if (!results) results = document.getElementById('value_results_' + '0').value;
    
    document.getElementById('value_mode_' + '0').value = mode;
    document.getElementById('value_difficulty_' + '0').value = difficulty;
    document.getElementById('value_level_' + '0').value = level;

    var xmlhttpLb = false;
    try {xmlhttpLb = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {
        try {xmlhttpLb = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {
            xmlhttpLb = false;
        }
    }
    if (!xmlhttpLb && typeof XMLHttpRequest != 'undefined') xmlhttpLb = new XMLHttpRequest ();

    paramInfoString = '?query=info';
    paramInfoString += '&gameid=' + gameid;
    paramInfoString += mode > 0 ? '&mode=' + mode : '';
    paramInfoString += difficulty > 0 ? '&difficulty=' + difficulty : '';
    paramInfoString += level > 0 ? '&level=' + level : '';
    paramInfoString += '&timeframe=' + timeframe;
    paramInfoString += '&results=' + results;

    xmlhttpLb.open ('GET', HTML_TOP + 'ajax/leaderboard.php' + paramInfoString, true);
    xmlhttpLb.onreadystatechange = function () {
        switch (xmlhttpLb.readyState) {
        case 1 : case 2 : case 3 :
            leaderboardInfoArea.innerHTML = '<div class="ajax-loader">&nbsp;</div>';
        break;
        case 4 :
            resultXML = xmlhttpLb.responseXML;
            returnHTML = '';

            result = resultXML.getElementsByTagName ("result");
            returnHTML = result[0].firstChild.nodeValue;

            leaderboardInfoArea.innerHTML = returnHTML;
            break;
        }
    }
    
    xmlhttpLb.send (null);
    return;
}

function setValue (whichOne, gameid, theValue) {
    document.getElementById('value_' + whichOne + '_' + '0').value = theValue;
}

function setValue2 (whichOne, gameid, theValue) {
    document.getElementById('value_2_' + whichOne + '_' + '0').value = theValue;
}

function changeTitle (whichDiv, theTitle) {
    document.getElementById (whichDiv).innerHTML = theTitle;
}

function getIt (gameid, whichOne, mode, difficulty, chainCall, timeframe, results) {
    infoArea = document.getElementById ('info_' + whichOne + '_' + '0');

    if (!mode) mode = document.getElementById('value_mode_' + '0').value;
    if (!difficulty) difficulty = document.getElementById('value_difficulty_' + '0').value;
    if (!timeframe) timeframe = document.getElementById('value_timeframe_' + '0').value;
    if (!results) results = document.getElementById('value_results_' + '0').value;

    document.getElementById('value_mode_' + '0').value = mode;
    document.getElementById('value_difficulty_' + '0').value = difficulty;
    document.getElementById('value_game_' + '0').value = gameid;

    xmlhttpLb = false;
    try {xmlhttpLb = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {
        try {xmlhttpLb = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {
            xmlhttpLb = false;
        }
    }
    if (!xmlhttpLb && typeof XMLHttpRequest != 'undefined') xmlhttpLb = new XMLHttpRequest ();

    paramGetItString = '?gameid=' + gameid;
    paramGetItString += '&whichOne=' + whichOne;
    paramGetItString += '&mode=' + mode;
    paramGetItString += '&difficulty=' + difficulty;

    xmlhttpLb.open ('GET', HTML_TOP + 'ajax/modedifficultylevel.php' + paramGetItString, true);
    xmlhttpLb.onreadystatechange = function () {
        switch (xmlhttpLb.readyState) {
            case 1 : case 2 : case 3 :
                infoArea.innerHTML = '<div class="ajax-loader">&nbsp;</div>';
            break;
            case 4 :
                resultHTML = xmlhttpLb.responseText;
                infoArea.innerHTML = resultHTML;

                if (chainCall) {
                    switch (whichOne) {
                        case "mode" :
                            getIt (gameid, 'difficulty', document.getElementById('value_mode_' + '0').value, 0, true, false, false);
                            break;
                        case "difficulty" :
                            getIt (gameid, 'level', document.getElementById('value_mode_' + '0').value, document.getElementById('value_difficulty_' + '0').value, true, false, false);
                        break;
                        case "level" :
                            getLeaderboard (gameid, false, false, false, timeframe, results)
                        break;
                    }
                }
            break;
        }
    }

    xmlhttpLb.send (null);
    return;
}

var gameExpanded = false;
var timeframeExpanded = false;
var resultsExpanded = false;
var modeExpanded = false;
var difficultyExpanded = false;
var levelExpanded = false;

var gameOptions;
var timeframeOptions;
var resultsOptions;
var modeOptions;
var difficultyOptions;
var levelOptions;

function collapseLeaderboard (whichOne) {
    switch (whichOne) {
        case 'game' :
            gameExpanded = false;
            gameOptions.className = 'middleInactiveFour';
            break;
        case 'timeframe' :
            timeframeExpanded = false;
            timeframeOptions.className = 'middleInactiveFour';
        break;
        case 'results' :
            resultsExpanded = false;
            resultsOptions.className = 'middleInactiveFour';
            break;
        case 'mode' :
            modeExpanded = false;
            modeOptions.className = 'middleInactive';
            break;
        case 'difficulty' :
            difficultyExpanded = false;
            difficultyOptions.className = 'middleInactive';
        break;
        case 'level' :
            levelExpanded = false;
            levelOptions.className = 'middleInactive';
        break;
    }
}

function expandLeaderboard (whichOne) {
    switch (whichOne) {
        case 'game' :
            gameExpanded = true;
            gameOptions.className = 'middleActiveFour';
            break;
        case 'timeframe' :
            timeframeExpanded = true;
            timeframeOptions.className = 'middleActiveFour';
        break;
        case 'results' :
            resultsExpanded = true;
            resultsOptions.className = 'middleActiveFour';
            break;
        case 'mode' :
            modeExpanded = true;
            modeOptions.className = 'middleActive';
            break;
        case 'difficulty' :
            difficultyExpanded = true;
            difficultyOptions.className = 'middleActive';
        break;
        case 'level' :
            levelExpanded = true;
            levelOptions.className = 'middleActive';
        break;
    }
}
