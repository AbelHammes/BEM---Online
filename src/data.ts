import { EventData } from "./types";

// The exact model files provided by the user, formatted for the simulation deck
export const BEM_MOCK_FILES = {
  classEntriesJson: {
    "Display Language": "Portuguese",
    "EventName": "I I Copa Dyamantina",
    "EventSponsor": "I Etapa - Circuito dos Vales",
    "EventLocation": "Venâncio Aires / RS",
    "ReportCreated": "21 Feb 2026 20:07:48",
    "ReportType": "CLASS ENTRIES",
    "Display ReportType": "CATEGORIA INSCRIÇÕES",
    "Category Report": [
      {
        "Category Heading": {
          "Category": "Boys 7/8",
          "Entries": "7",
          "Transfer": "",
          "Sponsor": ""
        },
        "Headers": ["Ref","Plate","Club","State","Country","First Name","Last Name","UCI ID","Merged From","Sponsor"],
        "Display Headers": ["REF","PLACA","CLUBE","ESTADO","PAÍS","Nome","Nome de Familia","ID da CBC","mesclado de","Patrocinador"],
        "Data": [
          ["","303","MOCVA (Venâncio Aires)","RS","BRA","Joaquim","ALVES","5985829081","",""],
          ["","96","Clube 19 (Sapiranga)","RS","BRA","Marvin","BAUM","5757853069","",""],
          ["","5","M4 Racing","RS","BRA","Bernardo","FARIAS","33763810112","",""],
          ["","188","SCBC (Santa Cruz)","RS","BRA","Bernardo","KIPPER","6328895003","",""],
          ["","124","LCBMX (Campo Bom)","RS","BRA","Heitor","PREUSS WINCK","5916471092","",""],
          ["","195","SCBC (Santa Cruz)","RS","BRA","Thobias","SCHUCH","6182591048","",""],
          ["","126","LCBMX (Campo Bom)","RS","BRA","Arthur","ZARDINELLO","5839511048","",""]
        ]
      }
    ]
  },

  motoDrawsJson: {
    "Display Language": "Portuguese",
    "EventName": "I I Copa Dyamantina",
    "EventSponsor": "I Etapa - Circuito dos Vales",
    "EventLocation": "Venâncio Aires / RS",
    "ReportCreated": "21 Feb 2026 20:07:48",
    "ReportType": "MOTO DRAWS: RACE / LANE",
    "Display ReportType": "MOTO (BATERIA) SORTEIOS: Corrida / Raia",
    "Category Report": [
      {
        "Category Heading": {
          "Category": "Boys 7/8",
          "Entries": "7",
          "Transfer": "Resultados em pontos",
          "Sponsor": ""
        },
        "Headers": ["Plate","Club","State","Country","First Name","Last Name","UCI ID","Merged From","Sponsor","M1","M2","M3"],
        "Display Headers": ["PLACA","CLUBE","ESTADO","PAÍS","Nome","Nome de Familia","ID da CBC","mesclado de","Patrocinador","M1","M2","M3"],
        "Data": [
          ["5","M4 Racing","RS","BRA","Bernardo","FARIAS","33763810112","","","10: 2","26: 7","42: 4"],
          ["303","MOCVA (Venâncio Aires)","RS","BRA","Joaquim","ALVES","5985829081","","","10: 3","26: 5","42: 6"],
          ["96","Clube 19 (Sapiranga)","RS","BRA","Marvin","BAUM","5757853069","","","10: 4","26: 8","42: 2"],
          ["124","LCBMX (Campo Bom)","RS","BRA","Heitor","PREUSS WINCK","5916471092","","","10: 5","26: 1","42: 7"],
          ["195","SCBC (Santa Cruz)","RS","BRA","Thobias","SCHUCH","6182591048","","","10: 6","26: 3","42: 5"],
          ["126","LCBMX (Campo Bom)","RS","BRA","Arthur","ZARDINELLO","5839511048","","","10: 7","26: 6","42: 1"],
          ["188","SCBC (Santa Cruz)","RS","BRA","Bernardo","KIPPER","6328895003","","","10: 8","26: 2","42: 3"]
        ]
      }
    ]
  },

  motoResultsJson: {
    "Display Language": "Portuguese",
    "EventName": "I I Copa Dyamantina",
    "EventSponsor": "I Etapa - Circuito dos Vales",
    "EventLocation": "Venâncio Aires / RS",
    "ReportCreated": "21 Feb 2026 20:07:48",
    "ReportType": "MOTO RESULTS REPORT",
    "Display ReportType": "Informe dos Resultados nas Motos(Baterias)",
    "Category Report": [
      {
        "Category Heading": {
          "Category": "Boys 7/8",
          "Entries": "7",
          "Transfer": "Resultados em pontos",
          "Sponsor": ""
        },
        "Headers": ["Plate","Club","State","Country","First Name","Last Name","UCI ID","Merged From","Sponsor","Rank","Points","M1 Place","M1 Lap Time","M1 Start Reaction","M2 Place","M2 Lap Time","M2 Start Reaction","M3 Place","M3 Lap Time","M3 Start Reaction","Transfer"],
        "Display Headers": ["PLACA","CLUBE","ESTADO","PAÍS","Nome","Nome de Familia","ID da CBC","mesclado de","Patrocinador","RANK ","pontos","M1 Lugar","M1 Tempo de volta","M1 Iniciar reação","M2 Lugar","M2 Tempo de volta","M2 Iniciar reação","M3 Lugar","M3 Tempo de volta","M3 Iniciar reação","TRANSFERIR"],
        "Data": [
          ["303","MOCVA (Venâncio Aires)","RS","BRA","Joaquim","ALVES","5985829081","","","1, 10","3","1st","34.120","0.180","1st","34.050","0.190","1st","34.200","0.185"," "],
          ["124","LCBMX (Campo Bom)","RS","BRA","Heitor","PREUSS WINCK","5916471092","","","2, 10","8","4th","36.450","0.210","2nd","35.110","0.203","2nd","35.320","0.195"," "],
          ["96","Clube 19 (Sapiranga)","RS","BRA","Marvin","BAUM","5757853069","","","3, 10","8","2nd","35.210","0.198","3rd","35.450","0.201","3rd","35.800","0.205"," "],
          ["126","LCBMX (Campo Bom)","RS","BRA","Arthur","ZARDINELLO","5839511048","","","4, 10","11","3rd","35.900","0.202","4th","36.200","0.210","4th","36.150","0.208"," "],
          ["195","SCBC (Santa Cruz)","RS","BRA","Thobias","SCHUCH","6182591048","","","5, 10","17","7th","38.500","0.230","5th","37.400","0.222","5th","37.100","0.215"," "],
          ["5","M4 Racing","RS","BRA","Bernardo","FARIAS","33763810112","","","6, 10","17","5th","37.110","0.215","6th","38.100","0.228","6th","37.800","0.231"," "],
          ["188","SCBC (Santa Cruz)","RS","BRA","Bernardo","KIPPER","6328895003","","","7, 10","20","6th","37.450","0.240","DNF: 7","","0.250","7th","39.100","0.245"," "]
        ]
      }
    ]
  },

  fullResultsJson: {
    "Display Language": "Portuguese",
    "EventName": "I I Copa Dyamantina",
    "EventSponsor": "I Etapa - Circuito dos Vales",
    "EventLocation": "Venâncio Aires / RS",
    "ReportCreated": "21 Feb 2026 20:07:48",
    "ReportType": "FULL RESULTS",
    "Display ReportType": "Resultados completos",
    "Category Report": [
      {
        "Category Heading": {
          "Category": "Boys 7/8",
          "Entries": "7",
          "Transfer": "",
          "Sponsor": ""
        },
        "Headers": ["Plate","Club","State","Country","First Name","Last Name","UCI ID","Merged From","Sponsor","Place","M-PTS","M 1 Place","M 1 Lap Time","M 1 Start Reaction","M 2 Place","M 2 Lap Time","M 2 Start Reaction","M 3 Place","M 3 Lap Time","M 3 Start Reaction"],
        "Display Headers": ["PLACA","CLUBE","ESTADO","PAÍS","Nome","Nome de Familia","ID da CBC","mesclado de","Patrocinador","Lugar","M-PTS","M 1 Place","M 1 Lap Time","M 1 Start Reaction","M 2 Place","M 2 Lap Time","M 2 Start Reaction","M 3 Place","M 3 Lap Time","M 3 Start Reaction"],
        "Data": [
          ["303","MOCVA (Venâncio Aires)","RS","BRA","Joaquim","ALVES","5985829081","","","1","3","1st","34.120","0.180","1st","34.050","0.190","1st","34.200","0.185"],
          ["124","LCBMX (Campo Bom)","RS","BRA","Heitor","PREUSS WINCK","5916471092","","","2","8","4th","36.450","0.210","2nd","35.110","0.203","2nd","35.320","0.195"],
          ["96","Clube 19 (Sapiranga)","RS","BRA","Marvin","BAUM","5757853069","","","3","8","2nd","35.210","0.198","3rd","35.450","0.201","3rd","35.800","0.205"],
          ["126","LCBMX (Campo Bom)","RS","BRA","Arthur","ZARDINELLO","5839511048","","","4","11","3rd","35.900","0.202","4th","36.200","0.210","4th","36.150","0.208"],
          ["195","SCBC (Santa Cruz)","RS","BRA","Thobias","SCHUCH","6182591048","","","5","17","7th","38.500","0.230","5th","37.400","0.222","5th","37.100","0.215"],
          ["5","M4 Racing","RS","BRA","Bernardo","FARIAS","33763810112","","","6","17","5th","37.110","0.215","6th","38.100","0.228","6th","37.800","0.231"],
          ["188","SCBC (Santa Cruz)","RS","BRA","Bernardo","KIPPER","6328895003","","","7","20","6th","37.450","0.240","DNF: 7","","0.250","7th","39.100","0.245"]
        ]
      }
    ]
  },

  classEntriesHtml: `<!DOCTYPE html>
<HTML>
<HEAD>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<TITLE>Bmx Event Manager by Lyndon.Downing@bigpond.com</TITLE>
</HEAD>
<BODY>
<H1 style="text-align:center;">I I  Copa Dyamantina</H1>
<H2 style="text-align:center;">Venâncio Aires / RS</H2>
<H4 style="text-align:center;">CATEGORIA INSCRIÇÕES</H4>
<table class="gridtable">
<caption style="text-align:left; font-size:1.5em;">Boys 7/8 (7 Riders)</caption>
<TR>
<TH style="width:6.5%;">REF</TH>
<TH style="width:26%;">ESTADO</TH>
<TH style="width:8%;">PLACA</TH>
<TH style="width:40%;">Nome</TH>
</TR>
<TR>
<TD></TD>
<TD>RS</TD>
<TD> 303</TD>
<TD><span style="font-size:125%;">ALVES, Joaquim</span></TD>
</TR>
<TR>
<TD></TD>
<TD>RS</TD>
<TD>  96</TD>
<TD><span style="font-size:125%;">BAUM, Marvin</span></TD>
</TR>
<TR>
<TD></TD>
<TD>RS</TD>
<TD>   5</TD>
<TD><span style="font-size:125%;">FARIAS, Bernardo</span></TD>
</TR>
</Table>
</BODY>
</HTML>`,

  motoDrawsHtml: `<!DOCTYPE html>
<HTML>
<HEAD>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<TITLE>Bmx Event Manager by Lyndon.Downing@bigpond.com</TITLE>
</HEAD>
<BODY>
<H1 style="text-align:center;">I I  Copa Dyamantina</H1>
<H2 style="text-align:center;">Venâncio Aires / RS</H2>
<H4 style="text-align:center;">MOTO (BATERIA) SORTEIOS: Corrida / Raia</H4>
<table class="gridtable">
<caption style="text-align:left; font-size:1.5em;">Boys 7/8 (7 Riders)<BR><I>Resultados em pontos</I></caption>
<TR>
<TH>PLACA</TH>
<TH>Nome</TH>
<TH>ESTADO</TH>
<TH>M 1</TH>
<TH>M 2</TH>
<TH>M 3</TH>
</TR>
<TR>
<TD>   5</TD>
<TD><span style="font-size:125%;">Bernardo FARIAS</span></TD>
<TD>M4 Racing</TD>
<TD>10: 2</TD>
<TD>26: 7</TD>
<TD>42: 4</TD>
</TR>
<TR>
<TD> 303</TD>
<TD><span style="font-size:125%;">Joaquim ALVES</span></TD>
<TD>MOCVA</TD>
<TD>10: 3</TD>
<TD>26: 5</TD>
<TD>42: 6</TD>
</TR>
</Table>
</BODY>
</HTML>`,

  motoResultsHtml: `<!DOCTYPE html>
<HTML>
<HEAD>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<TITLE>Bmx Event Manager</TITLE>
</HEAD>
<BODY>
<H1 style="text-align:center;">I I  Copa Dyamantina</H1>
<table class="gridtable">
<caption style="text-align:left; font-size:1.5em;">Boys 7/8 (7 Riders)<BR><I>Resultados em pontos</I></caption>
<TR>
<TH style="width:6.5%;">PLACA</TH>
<TH style="width:12%;">ESTADO</TH>
<TH style="width:22%;">Nome</TH>
<TH style="width:8%;">RANK </TH>
<TH style="width:8%;">pontos</TH>
<TH style="width:8%;">M 1</TH>
<TH style="width:8%;">M 2</TH>
<TH style="width:8%;">M 3</TH>
<TH style="width:8%;">TRANSFERIR</TH>
</TR>
<TR>
<TD> 303</TD>
<TD>RS</TD>
<TD><span style="font-size:125%;">Joaquim ALVES</span></TD>
<TD> 1, 10</TD>
<TD>3</TD>
<TD>1st<BR>0.000</TD>
<TD>1st<BR>0.000</TD>
<TD>1st<BR>0.000</TD>
<TD> </TD>
</TR>
<TR>
<TD> 124</TD>
<TD>RS</TD>
<TD><span style="font-size:125%;">Heitor PREUSS WINCK</span></TD>
<TD> 2, 10</TD>
<TD>8</TD>
<TD>4th<BR>0.000</TD>
<TD>2nd<BR>0.000</TD>
<TD>2nd<BR>0.000</TD>
<TD> </TD>
</TR>
</Table>
</BODY>
</HTML>`
};
