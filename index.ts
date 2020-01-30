import axios from 'axios';
import * as _ from 'lodash';
import * as fastXMLParser from 'fast-xml-parser';
import * as fs from 'fs';
import { getMongo } from './mongodb';
import { delay } from './delay';

interface IPublications {
  publikasjoner_liste: {
    respons_dato_tid: string;
    //versjon: '1.6',
    versjon: string;
    // dato: '/Date(1434319200000+0200)/',
    dato: string;
    // id: 's150615',
    id: string;
    publikasjonformat_liste: any[];
    tilgjengelig_dato: string;
    tittel: string;
    // tittel: 'Referat Stortingsmøte mandag 15. juni 2015';
    // type: 10
    type: number;
  }[];
  //respons_dato_tid: '/Date(1576417679347+0100)/';
}

const API_TOKEN =
  '4b932469d8c3163b7112a2d67667112c90411a6e3da6bb9a1d8fdd6351ab4ea9';

const BASE_URL = 'https://data.stortinget.no/eksport';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

const getUrl = (type, params) =>
  `/${type}?${params}&format=json&key=${API_TOKEN}`;

const getPublicationsUrl = (sessionId, publicationType) =>
  getUrl(
    'publikasjoner',
    `publikasjontype=${publicationType}&sesjonid=${sessionId}`
  );

const getPublicationByIdUrl = publicationId =>
  getUrl('publikasjon', `publikasjonid=${publicationId}`);

const isValidPublicationId = publicationId =>
  publicationId.startsWith('s') || publicationId.startsWith('refs');

async function doExport() {
  // fetch all publications per session id
  const {
    speechCollection,
    publicationCollection,
    mongodbClient,
  } = await getMongo();

  try {
    const allPublications: {
      data: IPublications;
    } = await axiosClient.get(getPublicationsUrl('2016-2017', 'referat'));

    const {
      data: { publikasjoner_liste },
    } = allPublications;

    for (const publicationListItem of publikasjoner_liste) {
      const publicationId: string = publicationListItem.id;

      if (!isValidPublicationId(publicationId)) {
        console.warn(`🐝Skipping publication with id: ${publicationId}`);
      } else {
        const publication = await getPublicationById(publicationId);
        console.log(publication);
        /* await upsertPublication(publicationId, publication); */
        const transformed = transform(publication);

        /* await upsertSpeech(transformed); */
        console.log(`✅ added publication with id: ${publicationId}`);

        await delay(500);
        process.exit(0);
      }
    }

    console.log('All done!! 👏👏');
    process.exit(0);
  } catch (err) {
    console.error('God damn shit failed 😿', err);
    process.exit(1);
  }

  function transform(publication) {
    const {
      Forhandlinger: {
        Mote: {
          Hovedseksjon: {
            Saker: { Sak },
          },
        },
      },
    } = publication;
    /* console.log(Sak); */
    const mapped = _(Sak)
      .map(sak => sak.Hovedinnlegg)
      .compact()
      .flatten()
      .groupBy(innlegg => cleanupName(innlegg.A[0].Navn))
      .value();

    for (const sak in mapped) {
      // todo: slice the first entry in every array of A.
      // reduce all array elements
    }

    /* .reduce((prev, curr) => {
        console.log(prev, curr);
        return prev.concat(curr);
      }) */
    return Sak;
  }

  function cleanupName(navn) {
    return navn.replace(/\[.*$/, '');
  }

  async function upsertPublication(publicationId, publication) {
    await publicationCollection.updateOne(
      { _id: publicationId },
      {
        $setOnInsert: {
          _id: publicationId,
        },
        $set: {
          ...publication,
        },
      },
      {
        upsert: true,
      }
    );
  }

  async function getPublicationById(publicationId: string) {
    const publicationByIdResult: {
      data: string;
    } = await axiosClient.get(getPublicationByIdUrl(publicationId));
    const publicationObj = fastXMLParser.parse(publicationByIdResult.data);
    return publicationObj;
  }
}

doExport();
