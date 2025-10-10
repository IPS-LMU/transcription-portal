import { Component, inject, OnInit } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { OctraAPIService } from '@octra/ngx-octra-api';

@Component({
  selector: 'tportal-about-modal',
  templateUrl: './about-modal.component.html',
  styleUrls: ['./about-modal.component.css'],
  standalone: true,
  imports: [],
})
export class AboutModalComponent implements OnInit {
  bsModalRef = inject(NgbActiveModal);
  private sanitizer = inject(DomSanitizer);
  private api = inject(OctraAPIService);

  public static options: NgbModalOptions = {
    backdrop: true,
    size: 'lg',
  };

  literature: {
    title: string;
    name: string;
    url: string;
    safeURL?: SafeUrl;
    year: number;
    month: number;
    bibText: string;
  }[] = [
    {
      title:
        'Draxler, C., Van den Heuvel, H., Van Hessen, A., Calamai, S., & Corti, L. (2020, May). A CLARIN Transcription Portal for Interview Data. In Proceedings of the Twelfth Language Resources and Evaluation Conference (pp. 3353-3359).',
      name: 'draxler-etal-2020-clarin',
      url: 'https://aclanthology.org/2020.lrec-1.411.pdf',
      year: 2020,
      month: 5,
      bibText: `@inproceedings{draxler-etal-2020-clarin,
    title = "A {CLARIN} Transcription Portal for Interview Data",
    author = "Draxler, Christoph  and
      van den Heuvel, Henk  and
      van Hessen, Arjan  and
      Calamai, Silvia  and
      Corti, Louise",
    editor = "Calzolari, Nicoletta  and
      B{\\'e}chet, Fr{\\'e}d{\\'e}ric  and
      Blache, Philippe  and
      Choukri, Khalid  and
      Cieri, Christopher  and
      Declerck, Thierry  and
      Goggi, Sara  and
      Isahara, Hitoshi  and
      Maegaard, Bente  and
      Mariani, Joseph  and
      Mazo, H{\\'e}l{\\\`e}ne  and
      Moreno, Asuncion  and
      Odijk, Jan  and
      Piperidis, Stelios",
    booktitle = "Proceedings of the Twelfth Language Resources and Evaluation Conference",
    month = may,
    year = "2020",
    address = "Marseille, France",
    publisher = "European Language Resources Association",
    url = "https://aclanthology.org/2020.lrec-1.411/",
    pages = "3353--3359",
    language = "eng",
    ISBN = "979-10-95546-34-4",
    abstract = "In this paper we present a first version of a transcription portal for audio files based on automatic speech recognition (ASR) in various languages. The portal is implemented in the CLARIN resources research network and intended for use by non-technical scholars. We explain the background and interdisciplinary nature of interview data, the perks and quirks of using ASR for transcribing the audio in a research context, the dos and don{'}ts for optimal use of the portal, and future developments foreseen. The portal is promoted in a range of workshops, but there are a number of challenges that have to be met. These challenges concern privacy issues, ASR quality, and cost, amongst others."
}`,
    },
    {
      title:
        'Draxler, C., Pömp, J., van den Heuvel, H., Ardolino, F., & van Hessen, A. (2025). Transcribing Oral History Recordings Using the Transcription Portal. In Proc. Interspeech 2025 (pp. 300-301).',
      name: 'draxler2025transcribing',
      url: 'https://www.isca-archive.org/interspeech_2025/draxler25_interspeech.pdf',
      bibText: `@inproceedings{draxler2025transcribing,
  title={Transcribing Oral History Recordings Using the Transcription Portal},
  author={Draxler, Christoph and P{\\"o}mp, Julian and van den Heuvel, Henk and Ardolino, Fabio and van Hessen, Arjan},
  booktitle={Proc. Interspeech 2025},
  pages={300--301},
  year={2025}
}`,
      year: 2025,
      month: 8,
    },
    {
      title:
        'van den Heuvel, H., Draxler, C., van Hessen, A., Corti, L., Scagliola, S., Calamai, S., & Karouche, N. (2019). A Transcription Portal for Oral History Research and Beyond. In Digital Humanities Conference 2019 (DH2019).',
      name: 'van2019transcription',
      url: 'https://usiena-air.unisi.it/bitstream/11365/1128807/1/0854a%20dh%202019.pdf',
      bibText: `@inproceedings{van2019transcription,
  title={A Transcription Portal for Oral History Research and Beyond},
  author={van den Heuvel, Henk and Draxler, Christoph and van Hessen, Arjan and Corti, Louise and Scagliola, Stefania and Calamai, Silvia and Karouche, Norah and others},
  booktitle={Digital Humanities Conference 2019 (DH2019)},
  year={2019}
}`,
      year: 2019,
      month: 7,
    },
    {
      title:
        'Draxler, C., & Pömp, J. (2023). Transcription Portal–A Zero-configuration Workbench for Transcribing Spoken Language Recordings. Elektronische Sprachsignalverarbeitung, 105, 170-172.',
      name: 'draxler2023transcription',
      url: 'https://www.essv.de/pdf/2023_170_172.pdf',
      bibText: `@article{draxler2023transcription,
  title={Transcription Portal--A Zero-configuration Workbench for Transcribing Spoken Language Recordings},
  author={Draxler, Christoph and P{\\"o}mp, Julian},
  journal={Elektronische Sprachsignalverarbeitung},
  volume={105},
  pages={170--172},
  year={2023}
}`,
      year: 2023,
      month: 3,
    },
  ];

  legals: {
    label: string;
    url: string;
  }[] = [];

  ngOnInit(): void {
    if (this.api.appProperties?.legals?.imprint_url) {
      this.legals.push({
        label: 'imprint',
        url: this.api.appProperties?.legals?.imprint_url,
      });
    }

    if (this.api.appProperties?.legals?.privacy_url) {
      this.legals.push({
        label: 'privacy',
        url: this.api.appProperties?.legals?.privacy_url,
      });
    }

    if (this.api.appProperties?.legals?.tos_url) {
      this.legals.push({
        label: 'terms and conditions',
        url: this.api.appProperties?.legals?.tos_url,
      });
    }

    this.prepareLiterature();
  }

  prepareLiterature() {
    this.literature.sort((a, b) => {
      if (a.year === b.year && a.month === b.month) {
        return 0
      } else {
        if (a.year === b.year) {
          return a.month > b.month ? -1 : 1;
        } else {
          return a.year > b.year ? -1 : 1;
        }
      }
    });

    for (const literatureItem of this.literature) {
      literatureItem.safeURL = this.sanitizer.bypassSecurityTrustResourceUrl(
        URL.createObjectURL(
          new File([literatureItem.bibText], `${literatureItem.name}.bib`, {
            type: 'text/plain',
          }),
        ),
      );
    }
  }
}
