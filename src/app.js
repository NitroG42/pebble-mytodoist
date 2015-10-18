var appKey = '4EBM';

var UI = require('ui');
var Vector2 = require('vector2');
var Ajax = require('ajax');

var TODOIST_API_URL = 'https://todoist.com/API/v6/sync?';

var todayString = "Today";
var overdueString = "overdue";

var textColor = 'lightGray';
var textHightLightColor = 'white';
var menuColor = 'black';
var highlightColor = 'darkCandyAppleRed';

var loading = new UI.Window();
var loadingBackground = new UI.Rect({position: new Vector2(0,0), size: new Vector2(144,168)});
var loadingText = new UI.Text({ position: new Vector2(0, 60), size: new Vector2(144, 20),
                               text:"Loading...", textAlign:"center", backgroundColor:"white",
                               color:'black'});
loading.add(loadingBackground);
loading.add(loadingText);
loading.show();

var token;
var seq_no = 0;
var seq_no_global = 0;

function displayMessage(title, subtitle) {
  var card = new UI.Card();
  card.title(title);
  if(subtitle) {
    card.subtitle(subtitle);
  }
  card.show();
}

function displayMessageWithSubtitle(subtitle) {
  var card = new UI.Card({
    subtitle:subtitle,
    scrollable:true
  });

  card.show();
}

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

function getSendCommand(type, args) {
  var uuid = generateUUID();
  var params = {
    token : token, 
    commands : JSON.stringify([{
      type : type,
      uuid : uuid,
      args : args
    }])
  };
  return {params:params, uuid:uuid};
}


Pebble.addEventListener('showConfiguration', function(e) {
  // Show config page
  Pebble.openURL('http://x.SetPebble.com/'+ appKey +'/' + Pebble.getAccountToken());
});


Pebble.addEventListener('appmessage', function(e) {
  var key = e.payload.action;
  if (typeof(key) != 'undefined') {
    var settings = localStorage.getItem(appKey);
    console.log("settings: " + settings);
    if (typeof(settings) == 'string') {
      try {
      Pebble.sendAppMessage(settings);
      } catch (exception) {
      }
  }
  var request = new XMLHttpRequest();
  request.open('GET', 'http://x.SetPebble.com/api/' + appKey + '/' + Pebble.getAccountToken(), true);
  request.onload = function(e) {
    if (request.readyState == 4)
      if (request.status == 200)
        try {
          Pebble.sendAppMessage(JSON.parse(request.responseText)["1"]);
        } catch (exception) {
        }
  };
  request.send(null);
  }
});


Pebble.addEventListener('webviewclosed', function(e) {
  if ((typeof(e.response) == 'string') && (e.response.length > 0)) {
    try {
      console.log("response : " + e.response);
      Pebble.sendAppMessage(JSON.parse(e.response)["1"]);
      localStorage.setItem(appKey, JSON.parse(e.response)["1"]);
    } catch(exception) {
    }
  }
});

var COMMAND_COMPLETE_ITEM = "item_complete";
var COMMAND_UNCOMPLETE_ITEM = "item_uncomplete";
var COMMAND_UPDATE_RECURING_ITEM = "item_update_date_complete";

function completeItem(menu, sectionIndex, menuItemIndex, menuItem) {
  if(menuItem.item) {
    console.log('id ' + menuItem.item.id);
    var id = JSON.stringify([menuItem.item.id]);
    var checked = menuItem.item.checked;
    
    var args = {
        project_id: menuItem.item.project_id,
        ids: id
    };
    var command;
    if(checked) {
      command = getSendCommand(COMMAND_UNCOMPLETE_ITEM, args);
    } else {
      if(menuItem.item.indent > 1) {
        args.force_history = 0;
      }
      console.log("date string : " + menuItem.item.date_string);
      command = getSendCommand(COMMAND_COMPLETE_ITEM, args);
    }
    console.log("data : " + JSON.stringify(command.params, null, 4));
    Ajax(
      {
        url: TODOIST_API_URL+Ajax.formify(command.params),
        type: 'json',
      },
      function(data) {
        console.log(JSON.stringify(data, null, 4));
        console.log("status : " + data.SyncStatus[command.uuid][menuItem.item.id]);
        if(data.SyncStatus[command.uuid][menuItem.item.id] == "ok") {
          menuItem.item.checked = !menuItem.item.checked;
          if(checked) {
            menu.item(sectionIndex, menuItemIndex, {title:menuItem.title, item:menuItem.item, icon:''});
          } else {
            menu.item(sectionIndex, menuItemIndex, {title:menuItem.title, item:menuItem.item, icon:'images/checkmark.png'});
          }
        }
      },
      function(error) {
        console.log("error : " + JSON.stringify(error, null, 4));
      }      
    );
    console.log(menuItem.icon);
  } else {
     displayMessage('Error');
  }
}

function updateRecurringItem(menu, sectionIndex, menuItemIndex, menuItem) {
  if(menuItem.item) {
    console.log('id ' + menuItem.item.id);
    
    var args = {
        id: menuItem.item.id
    };
    var command = getSendCommand(COMMAND_UPDATE_RECURING_ITEM, args);

    console.log("data : " + JSON.stringify(command.params, null, 4));
    Ajax(
      {
        url: TODOIST_API_URL+Ajax.formify(command.params),
        type: 'json',
      },
      function(data) {
        console.log(JSON.stringify(data, null, 4));
        console.log("status : " + data.SyncStatus[command.uuid]);
        if(data.SyncStatus[command.uuid] == "ok") {
          
        }
      },
      function(error) {
        console.log("error : " + JSON.stringify(error, null, 4));
      }      
    );
    console.log(menuItem.icon);
  } else {
     displayMessage('Error');
  }
}


function replaceGmail(item) {
  if (item.content.search(/^https:\/\/mail.google.com/) === 0){
    var rpl = item.content.match(/\((.+)\)/);
    item.content = item.content.replace(/^.*$/, rpl[1]);
    return item;
  }
}

function clickOnItemProject(projectItem, itemsTodoist) {
  if(projectItem.custom) {
    if(projectItem.title == todayString.toUpperCase()) {
      queryToday(itemsTodoist);
    }
  } else {
    displayProject(projectItem.project, itemsTodoist);
  }
}

function queryToday() {
    var itemsMenu = new UI.Menu({
                backgroundColor: menuColor,
          textColor: textColor,
          highlightBackgroundColor: highlightColor,
          highlightTextColor: textHightLightColor,
  sections: [{
      title: overdueString,
      items: []
    }, {
      title: todayString,
      items: []
    }]
  });
    var params = {
      token: token,
      queries: JSON.stringify([todayString, overdueString])
    };
  Ajax(
  {
    url: 'https://todoist.com/API/query?' + Ajax.formify(params) ,
    type: 'json',
  },
  function(data) {
      console.log(data);
      console.log('data: '+ JSON.stringify(data, null, 4));
    
    var itemOverdue = data[1].data;
    var itemToday = data[0].data;
    var itemListFromData = [];
    itemListFromData = itemListFromData.concat(itemOverdue);
    itemListFromData = itemListFromData.concat(itemToday);    

    if(itemListFromData && itemListFromData.length > 0) {
      var itemsMenuOverdue = [];
      var itemsMenuToday = [];
      itemOverdue.forEach(function(item, index, array) {
        var icon = item.checked ? 'images/checkmark.png' : '';
        replaceGmail(item);
        itemsMenuOverdue.push({title:item.content, item:item, icon:icon});
      });
      itemToday.forEach(function(item, index, array) {
        var icon = item.checked ? 'images/checkmark.png' : '';
        replaceGmail(item);
        itemsMenuToday.push({title:item.content, item:item, icon:icon});
      });
      
      itemsMenu.items(0,itemsMenuOverdue);
      itemsMenu.items(1,itemsMenuToday);
      itemsMenu.on('select', function(e) {
          onItemClick(e);
      });
      itemsMenu.on('longSelect', function(e) {
        displayMessageWithSubtitle(e.item.item.content);
      });
      itemsMenu.show();   
    } else {
      displayMessage(todayString, "No tasks today");
    }
  },
  function(error) {
    console.log('fail to query today');
    console.log(error);
  }
);
}

function onItemClick(e) {
  if(e.item.item.date_string) {
            updateRecurringItem(e.menu, e.sectionIndex, e.itemIndex, e.item);
          } else {
            completeItem(e.menu, e.sectionIndex, e.itemIndex, e.item);
          }
}

function displayProject(project, itemsTodoist) {
  var itemsMenu = new UI.Menu({
              backgroundColor: menuColor,
          textColor: textColor,
          highlightBackgroundColor: highlightColor,
          highlightTextColor: textHightLightColor,
  sections: [{
      title: project.name,
      items: []
    }]
  });
    if(itemsTodoist && itemsTodoist.length > 0) {
      var itemsFromProject = [];
      itemsTodoist.forEach(function(item, index, array) {
        if(item.project_id == project.id) {
           itemsFromProject.push(item);
        }
      });
      if(itemsFromProject.length > 1) {
       itemsFromProject.sort(function(a,b) {
             return a.item_order - b.item_order;
          });
      }
      if(itemsFromProject.length > 0) {
        var items = [];
        itemsFromProject.forEach(function(item, index, array) {
            var icon = item.checked ? 'images/checkmark.png' : '';
            replaceGmail(item);
          items.push({title:item.content, subtitle:item.due_date, item:item, icon:icon});
        });
        itemsMenu.items(0,items);
        itemsMenu.on('select', function(e) {
          onItemClick(e);
        });
        itemsMenu.on('longSelect', function(e) {
          displayMessageWithSubtitle(e.item.item.content);
        });
        itemsMenu.show(); 
      } else {
        displayMessage(project.name, "No tasks to display");
      }
    } else {
      displayMessage(project.name, "No tasks to display");
    }
}

var resource_types = JSON.stringify(["projects", "items"]);

function loadProjects() {
  token = "e007f5a977462411441280c12cd8f63e4c5a8d33";
  if(token) {
    var params = {
      token: token,
      seq_no: seq_no,
      seq_no_global: seq_no_global,
      resource_types: resource_types
    };

    Ajax(
      {
        url: TODOIST_API_URL+Ajax.formify(params),
        type: 'json'
      },
      function(data) {
//        console.log("success");
        var menu = new UI.Menu({
          backgroundColor: menuColor,
          textColor: textColor,
          highlightBackgroundColor: highlightColor,
          highlightTextColor: textHightLightColor,
          sections: [{
            title: 'Projects',
            items: []
          }]
        });
        loading.hide();
        //console.log('data: '+ JSON.stringify(data, null, 4));
        
        var projectMenuItems = [];
        projectMenuItems.push({title:todayString.toUpperCase(), project:null, custom:true});
        var projectsTodoist = data.Projects;
        if(projectsTodoist && projectsTodoist.length > 1) {
          projectsTodoist.sort(function(a,b) {
             return a.item_order - b.item_order;
          });
        }
        projectsTodoist.forEach(function(project, index, array) {
          projectMenuItems.push({title:project.name.toUpperCase(), project:project, custom:false});
        });
        var itemsTodoist = data.Items;
        menu.items(0,projectMenuItems);
        menu.on('select', function(e) {
          clickOnItemProject(e.item, itemsTodoist);
        });
        menu.show();
      },
      function(error) {
        loading.hide();
        if(!error) {
          displayMessage('Network', 'No network, or network problem');
        } else {
          console.log("token :" + token);
          console.log(error);
          displayMessage('Token ID', 'Error, bad token');
        }
      }
    );
  } else {
    displayMessage('Token ID', 'Please set your token ID in the app\'s settings');
  }
}
//token = localStorage.getItem(appKey);
loadProjects();