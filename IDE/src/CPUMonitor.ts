import * as child_process from 'child_process';
import * as pidtree from 'pidtree';

// this module monitors the linux-domain CPU usage of a running bela process
// once it has found the correct pid it calls the callback passed to start()
// every second with the cpu usage as a parameter

let name: string;
let interval: NodeJS.Timer;
let found_pid: boolean = false;
let root_pid: number;
let main_pid: number;
let callback: (cpu: any) => void;

export function start(pid: number, project: string, cb: (cpu: any)=>void){
	root_pid = pid;
	// the process name gets cut off at 15 chars
	name = project.substring(0, 15);
	callback = cb;
	interval = setInterval( () => interval_func(), 1000);
}

export function stop(){
	clearInterval(interval);
}

// this function keeps trying every second to find the correct pid
// once it has, it uses ps to get the cpu usage, and calls the callback
async function interval_func(){
	let cpu = '0';
	if (!found_pid){
		// use pidtree to find all the child pids of the make process
		await pidtree(root_pid, {root: true})
			.then(async (pids: any) => {
				// look through the pids to see if any of them belong to a process with the right name
				for (let pid of pids){
					let test_name = (await name_from_pid(pid) as string).trim();
					if (test_name === name){
						main_pid = pid;
						found_pid = true;
					}
				}
			})
			.catch( (e: Error) => {
				console.log('error finding pid');
				found_pid = false;
			});
	} else {
		cpu = await getCPU()
			.catch( (e: any) => {
				console.log('ps error'); 
				found_pid = false;
			});
	}
	callback(cpu);
}

// returns the name of the process corresponding to the pid passed in to it
function name_from_pid(pid: number){
	return new Promise((resolve, reject) => {
		child_process.exec('ps -p '+pid+' -o comm=', (err, stdout) => {
			if (err) reject(err);
			resolve(stdout);
		});
	});
}

function getCPU(){
	return new Promise((resolve, reject) => {
		child_process.exec('ps -p '+main_pid+' -o %cpu --no-headers', (err, stdout) => {
			if (err) reject(err);
			resolve(stdout);
		});
	});
}