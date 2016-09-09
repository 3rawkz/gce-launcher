const CLIENT_ID =
    "82527149933-0b4975omj32if91m551eqb3q8bmmdcbv.apps.googleusercontent.com";
const API_KEY = "AIzaSyCxck1nrcctZa_WX4-JDwOBTMOBCOQqzxo";
const SCOPES = 'https://www.googleapis.com/auth/compute';
const DEFAULT_PROJECT = "genial-airway-99405";
const DEFAULT_ZONE = "us-west1-b";
const DISK_NAME = "debian";

function onLoadFn() {
  gapi.client.setApiKey(API_KEY);
  gapi.client.load('compute', "v1");
  auth();
}

function auth() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      if (!token) {
	alert('login failed!');
	reject();
	return;
      }
      gapi.auth.setToken({access_token: token});
      resolve();
    });
  });
}

const listeners = {
  list_instances: (request) =>
		      gapi.client.compute.instances
			  .list({
			    project: request.project || DEFAULT_PROJECT,
			    zone: request.zone || DEFAULT_ZONE,
			    filter: 'status ne TERMINATED'
			  })
			  .then((resp) => resp.result.items),

  list_disks: (request) => gapi.client.compute.disks
			       .list({
				 project: request.project || DEFAULT_PROJECT,
				 zone: request.zone || DEFAULT_ZONE,
			       })
			       .then((resp) => resp.result.items),

  list_machine_types: (request) =>
			  gapi.client.compute.machineTypes
			      .list({
				project: request.project || DEFAULT_PROJECT,
				zone: request.zone || DEFAULT_ZONE,
			      })
			      .then((resp) => resp.result.items),

  create_instance: (request) => {
    const zone = request.zone || DEFAULT_ZONE;
    const disk_name = request.disk || DISK_NAME;
    const disk = {
      source: "zones/" + zone + "/disks/" + disk_name,
      type: 'PERSISTENT',
      boot: true
    };
    const network = {
      network: "global/networks/default",
      name: "nic0",
      accessConfigs: [{
	type: "ONE_TO_ONE_NAT",
	name: "External NAT",
      }]
    };
    const instance = {
      name: "instance-" + disk_name,
      disks: [disk],
      machineType: "zones/" + zone + "/machineTypes/" + request.machine_type,
      networkInterfaces: [network],
      tags: {items: ["http-server", "https-server"]},
      serviceAccounts: [{
	email: "default",
	scopes: [
	  "https://www.googleapis.com/auth/logging.write",
	  "https://www.googleapis.com/auth/monitoring.write",
	  "https://www.googleapis.com/auth/compute",
	  "https://www.googleapis.com/auth/servicecontrol",
	  "https://www.googleapis.com/auth/service.management.readonly",
	  "https://www.googleapis.com/auth/devstorage.read_only"
	]
      }]
    };
    return gapi.client.compute.instances
	.insert({
	  project: request.project || DEFAULT_PROJECT,
	  zone: zone,
	  resource: instance,
	})
	.then((resp) => resp.result);
  },

  cleanup_instance:
      (request) => gapi.client.compute.instances
		       .delete({
			 project: request.project || DEFAULT_PROJECT,
			 zone: request.zone || DEFAULT_ZONE,
			 instance: 'instance-' + (request.disk || DISK_NAME),
		       })
		       .then((resp) => resp.result),
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request.op, "request", request);
  const listener = listeners[request.op];
  if (listener) {
    auth()
	.then(() => listener(request, sender))
	.then((result) => {
	  console.log(request.op, "result", result);
	  sendResponse(result);
	})
	.catch((err) => {
	  console.log(request.op, "error", err);
	  sendResponse({error: err});
	});
    return true;
  }
  sendResponse({error: "no handler for " + request.op});
});

function onGAPILoad() {
  gapi.load("client:auth", onLoadFn);
}

var head = document.getElementsByTagName('head')[0];
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = "https://apis.google.com/js/client.js?onload=onGAPILoad";
head.appendChild(script);
