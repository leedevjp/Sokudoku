import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pilotSentences} from '../lib/sentence/content';
import {conjugate} from '../lib/sentence/rules';
test('contextual sockets retain their exact original and six reasoned candidates',()=>{
 for(const s of pilotSentences)for(const socket of s.sockets){
 assert.equal(s.text.slice(socket.start,socket.start+socket.original.length),socket.original);
 assert.equal(new Set(socket.options.map(o=>o.text)).size,6);
 assert(socket.options.every(o=>o.reason&&o.reason.length>10));
 assert(socket.options.some(o=>o.accepted&&o.text===socket.original));
 assert(socket.options.some(o=>!o.accepted));assert(s.translation.length>0);
 }
});
test('verb groups and explicit exceptions generate pilot forms',()=>{
 assert.equal(conjugate({term:'洗う',stem:'洗',verbClass:'godan'},'past_polite'),'洗いました');
 assert.equal(conjugate({term:'見積もる',stem:'見積も',verbClass:'godan'},'te'),'見積もって');
 assert.equal(conjugate({term:'調達',stem:'調達',verbClass:'suru'},'te'),'調達して');
 assert.equal(conjugate({term:'いる',stem:'い',verbClass:'ichidan'},'negative'),'いない');
 assert.equal(conjugate({term:'行く',stem:'行',verbClass:'godan'},'past_plain',{past_plain:'行った'}),'行った');
});
