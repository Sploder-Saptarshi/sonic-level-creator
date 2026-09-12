var achievementsPointer;
var achievements;

function moveAchievementsPointer (whichOne) {
	achievementsPointer.tween('width', (whichOne * 65) - 20); // 65 is the 60 width + the 5 margin. The 10 is for positioning
	achievementsContent.innerHTML = achievements[whichOne];
}



/*
var achievementMorph;

function moveAchievementPointer (whichOne) {



	$('achievementsPointer').addEvent('click', function(e) {
		e.stop();
		achievementMorph.start({
			height: '200px',
			color: '#C6D880'
		});
	});
}

*/