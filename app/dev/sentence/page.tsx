import {notFound} from 'next/navigation';
import SentenceGame from '@/app/sentence/sentence-game';
import {pilotSentences} from '@/lib/sentence/content';
export default function Preview(){if(process.env.NODE_ENV!=='development')notFound();return <SentenceGame sentences={pilotSentences}/>;}
