export type VerbClass = 'godan' | 'ichidan' | 'suru' | 'kuru';
export type Form = 'dictionary' | 'past_plain' | 'te' | 'polite' | 'past_polite' | 'negative';
export type Verb = { term:string; stem:string; verbClass:VerbClass };
/** Overrides are complete forms. Unsupported inputs fail closed. */
export function conjugate(v:Verb, form:Form, overrides:Partial<Record<Form,string>>={}):string {
 if(overrides[form]) return overrides[form]!;
 if(v.verbClass==='kuru') throw Error('KURU_REQUIRES_READING_AWARE_OVERRIDE');
 if(v.verbClass==='suru') return v.stem+({dictionary:'する',past_plain:'した',te:'して',polite:'します',past_polite:'しました',negative:'しない'}[form]);
 if(form==='dictionary') return v.term;
 if(v.verbClass==='ichidan') return v.stem+({past_plain:'た',te:'て',polite:'ます',past_polite:'ました',negative:'ない'}[form]);
 const ending=v.term.at(-1)!;
 const map:Record<string,[string,string,string,string]>={う:['い','わ','った','って'],つ:['ち','た','った','って'],る:['り','ら','った','って'],む:['み','ま','んだ','んで'],ぶ:['び','ば','んだ','んで'],ぬ:['に','な','んだ','んで'],く:['き','か','いた','いて'],ぐ:['ぎ','が','いだ','いで'],す:['し','さ','した','して']};
 const rule=map[ending]; if(!rule) throw Error('UNSUPPORTED_ENDING');
 return v.stem+({past_plain:rule[2],te:rule[3],polite:rule[0]+'ます',past_polite:rule[0]+'ました',negative:rule[1]+'ない'}[form]);
}
