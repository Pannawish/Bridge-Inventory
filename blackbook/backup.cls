\NeedsTeXFormat{LaTeX2e}[1995/12/01]
\ProvidesClass{mahidol_thesis} [2021/10/16 v0.01 Mahidol Undergrad Thesis class]
\LoadClass[12pt,a4paper,oneside]{book}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Require package being used
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\RequirePackage{geometry}
\RequirePackage{etoolbox}       % for patching the command
\RequirePackage{multicol}
\RequirePackage{fancyhdr}
\RequirePackage{fancybox}
\RequirePackage{sectsty}
\RequirePackage[titles]{tocloft}    %Enable feature of spliting Title in TOC and Document (eg. chapter[toc_title]{doc_title})
\RequirePackage{ccaption}
\RequirePackage{fontspec}
\RequirePackage{ifthen}
\RequirePackage{setspace}
\RequirePackage{graphicx}
\RequirePackage{lastpage}
\RequirePackage{refcount}
\RequirePackage{titlesec}
\RequirePackage{caption}
\RequirePackage{indentfirst}    %Enable indentation of first paragraph 
\RequirePackage{enumitem}
\RequirePackage{tocbibind}
\RequirePackage{tabularx}
\RequirePackage{polyglossia}
\RequirePackage{latexsym}       %Mathematic Symbols
\RequirePackage{listings}
\RequirePackage{float}
\RequirePackage{pbox}       
\RequirePackage[square,numbers]{natbib}         %Bibliography Style Configuration
 
\RequirePackage[Latin,Thai]{ucharclasses} % For automatic switching between languages

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Font Setting
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Note: THSarabun generates the errors due to it doesnot contain Thai and Latin script. Change font type supporting by polyglossia is the only way to solve this issue.
\newfontfamily{\engfont}{Times New Roman}[
     Script=Latin,
%     SizeFeatures = {Size=12},
    %  Path=./Font/,
    %  Extension = .ttf,
    %  Scale = 1.33,            %Scale Default Font size (12pt) to 16pt (1.33)
    %  UprightFont = *Regular,
    %  ItalicFont = *Italic,
    %  BoldFont = *Bold,
    %  BoldItalicFont = *BoldItalic,
]
\newfontfamily{\thaifont}{THSarabun}[
    Script=Thai, 
    Path=./Font/,
    Extension = .ttf,
    Scale = 1.33,            %Scale Default Font size (12pt) to 16pt (1.33)
    UprightFont = *Regular,
    ItalicFont = *Italic,
    BoldFont = *Bold,
    BoldItalicFont = *BoldItalic,
]
\setmainfont{Times New Roman}
 [    %Default font 
     Ligatures=TeX, 
     Script=Latin, 
     SizeFeatures = {Size=12},
    %  Scale = 1.33,            %Scale Default Font size (12pt) to 16pt (1.33)
    %  Path=./Font/,
    %  Extension = .ttf,
    %  UprightFont = *Regular,
    %  ItalicFont = *Italic,
    %  BoldFont = *Bold,
    %  BoldItalicFont = *BoldItalic,
 ]
\setmainlanguage{english}                  %Option of polyglossia package (for using \thaiAlph)
\setTransitionTo{Thai}{\thaifont}       %set to Thai font when found Thai characters 
\setTransitionsForLatin{\engfont}{}     %set to English font when found Eng characters

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Global Page, Body and Header Layout Setting
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\geometry{
    a4paper,
    % twoside,               %use twoside if swapping left/right margin is required  
%    showframe,             %show page geometry layout
    left=3.75cm,
    right=2.5cm, 
    top=3.75cm,
    bottom=2.5cm,
    headheight = 0.51cm,
    headsep = 2cm,
    %nofoot,
    nomarginpar
}
\setlength{\parindent}{1.6cm}	        % Set indentation to 1cm 
\renewcommand{\baselinestretch}{1.5}    % Set width between lines
\setlist{               % set format of lists and items
    leftmargin=1.2cm,           %list indentation
    noitemsep,                  %no line space between items
    nolistsep                   %no linie space between lists
}    
\XeTeXlinebreaklocale "th"              % Set text wrapping for Thai language 
\XeTeXlinebreakskip = 0pt plus 0pt      % Set

\renewcommand{\headrulewidth}{0pt}      % Remove header horizontal line 
\renewcommand{\footrulewidth}{0pt}      % Remove footer horizontal line 
%----------- Header Styles -------------------
\fancypagestyle{plain}{         %  1st page of Chapter header style
    \fancyhead[L,R]{}
    \fancyfoot{}
}

\fancypagestyle{front}{         % Front Cover Header style (Incd. abstract, toc, lot, lof)
    \fancyhead[L]{\@headerFont{\thesisDepENG, Mahidol University}}
    \fancyhead[R]{\@headerFont{\thesisTitle~/ \thepage}}
    \fancyfoot{}
}

\fancypagestyle{chapter}{       % Chapter Header style
    \fancyhead[L]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{\thesisDepENG, Mahidol University}}{}} %{odd}{even} page header
    \fancyhead[R]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{B.Eng~(\thesisDepENG)~/~\thepage}}{\@headerFont{\leftmark~/~\thepage}}} %{odd}{even} page header
    \fancyfoot{}
}

\fancypagestyle{bibliography}{       % Chapter Header style
    \fancyhead[L]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{\thesisDepTH, มหาวิทยาลัยมหิดล}}{\@headerFont{บรรณานุกรม}}} %{odd}{even} page header
    \fancyhead[R]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{วศ.บ.(\thesisDepTH)~/~\thepage}}{\@headerFont{\thepage}}} %{odd}{even}page header
    \fancyfoot{}
}

\fancypagestyle{appendix}{       % Chapter Header style
    \fancyhead[L]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{\thesisDepENG, Mahidol University}}{}} %{odd}{even} page header
    \fancyhead[R]{\ifthenelse{\isodd{\value{page}}}{\@headerFont{B.Eng(\thesisDepENG)~/~\thepage}}{\@headerFont{Appendix~/~\thepage}}} %{odd}{even} page header
    \fancyfoot{}
}

%------------ Set up left align table caption ----------------
\captionsetup[table]{labelsep=space, justification=raggedright, singlelinecheck=off}


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Cover Page layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Thai Cover page
% \newcommand{\coverpageTH}{
% \backmatter
% \thispagestyle{empty}
% \begin{center}
% \includegraphics[width=3cm]{./figures/MU_Logo-BW.png}\\
% \vspace*{0.7cm}
% %\@cpFont{
% \textbf{\thesisTitleTH}\\
% \vfill
% \makeatletter% Start TeX commands
% \begin{tabular}{l@{\hspace{20pt}}l}
% \thesisFirstTitleNameTH\thesisFirstAuthorNameTH&\thesisFirstAuthorLastNameTH\\
% \@ifundefined{thesisSecondAuthorNameTH}
% {}			
% {
% \thesisSecondTitleNameTH\thesisSecondAuthorNameTH&\thesisSecondAuthorLastNameTH\\ 
% \@ifundefined{thesisThirdAuthorNameTH}
% {}
% {
% \thesisThirdTitleNameTH\thesisThirdAuthorNameTH&\thesisThirdAuthorLastNameTH\\
% \@ifundefined{thesisFourthAuthorNameTH}
% {}
% {        			        \thesisFourthTitleNameTH\thesisFourthAuthorNameTH&\thesisFourthAuthorLastNameTH\\
% }
% }
% }	
% \end{tabular}
% \makeatother % End TeX commands
% \vfill
% รายงานนี้เป็นส่วนหนึ่งของการศึกษาวิชาโครงงาน\thesisDepTH\\
% ตามหลักสูตรวิศวกรรมศาสตร์บัณฑิต\\
% สาขา\thesisDepTH\\
% คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล\\
% ปีการศึกษา~\thesisAcademicYearTH
% \end{center}
% %}   % End of cpFont command (Font for Cover Page)
% \clearpage
% }

% English Cover page
\newcommand{\coverpageENG}{
\backmatter
\thispagestyle{empty}
\begin{spacing}{1.15}
\begin{center}
\includegraphics[width=3cm]{./figures/MU_Logo-BW.png}\\
\vspace*{0.7cm}
\@cpFont{
\MakeUppercase{\thesisTitle}\\
\vfill
\makeatletter% Start TeX commands
\begin{tabular}{l@{\hspace{20pt}}l}
\MakeUppercase{\thesisFirstTitleName\thesisFirstAuthorName}&\MakeUppercase{\thesisFirstAuthorLastName}\\
\@ifundefined{thesisSecondAuthorName}
{}			
{
\MakeUppercase{\thesisSecondTitleName\thesisSecondAuthorName}& \MakeUppercase{\thesisSecondAuthorLastName}\\ 
\@ifundefined{thesisThirdAuthorName}
{}
{
\MakeUppercase{\thesisThirdTitleName\thesisThirdAuthorName}& \MakeUppercase{\thesisThirdAuthorLastName}\\
\@ifundefined{thesisFourthAuthorName}
{}
{\MakeUppercase{\thesisFourthTitleName\thesisFourthAuthorName}&\MakeUppercase{\thesisFourthAuthorLastName}\\
}
}
}
\end{tabular}
\makeatother % End TeX commands
\vfill
A PROJECT REPORT SUBMITTED IN PARTIAL \\
FULFILLMENT OF THE REQUIREMENT FOR THE DEGREE\\
BACHELOR OF ENGINEERING IN \MakeUppercase{\thesisDepENG}\\[\baselineskip]
FACULTY OF ENGINEERING \& INTERNATIONAL COLLEGE\\
MAHIDOL UNIVERSITY\\
\thesisAcademicYear\\[\baselineskip]
} %End cpFont
\end{center}
\end{spacing}
\clearpage
}

%Second English Cover page
\newcommand{\coverpageENGTwo}{
\backmatter
\thispagestyle{empty}
\begin{spacing}{1.15}
\begin{center}
\@cpNormalFont{
~\\[2\baselineskip]
\MakeUppercase{\thesisTitle}\\
\vfill
\makeatletter% Start TeX commands
\begin{tabular}{l@{\hspace{20pt}}l}
\MakeUppercase{\thesisFirstTitleName\thesisFirstAuthorName}&\MakeUppercase{\thesisFirstAuthorLastName}\\
\@ifundefined{thesisSecondAuthorName}
{}			
{
\MakeUppercase{\thesisSecondTitleName\thesisSecondAuthorName}& \MakeUppercase{\thesisSecondAuthorLastName}\\ 
\@ifundefined{thesisThirdAuthorName}
{}
{
\MakeUppercase{\thesisThirdTitleName\thesisThirdAuthorName}& \MakeUppercase{\thesisThirdAuthorLastName}\\
\@ifundefined{thesisFourthAuthorName}
{}
{\MakeUppercase{\thesisFourthTitleName\thesisFourthAuthorName}&\MakeUppercase{\thesisFourthAuthorLastName}\\
}
}
}
\end{tabular}
\makeatother % End TeX commands
\vfill
A PROJECT REPORT SUBMITTED IN PARTIAL \\
FULFILLMENT OF THE REQUIREMENT FOR THE DEGREE\\
BACHELOR OF ENGINEERING IN \MakeUppercase{\thesisDepENG}\\[\baselineskip]
FACULTY OF ENGINEERING \& INTERNATIONAL COLLEGE\\
MAHIDOL UNIVERSITY\\
\thesisAcademicYear\\[\baselineskip]
} %End cpNormalFont
\end{center}
\end{spacing}
\clearpage
}


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Entitled page layout I 
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand{\entitlepageOne}{
\backmatter
\thispagestyle{empty}
\begin{spacing}{1.15}
\begin{center}
Computer Engineering Project\\
entitled\\
\@cpFont{\MakeUppercase{\thesisTitle}}
\vfill


\begin{tabbing} 
\@signbox{\thesisFirstTitleName\thesisFirstAuthorName~\thesisFirstAuthorLastName\\Researcher}
\@ifundefined{thesisSecondAuthorName}
{\\[3\baselineskip]}
{
\hspace{0.16\textwidth}\=\@signbox{\thesisFirstTitleName\thesisFirstAuthorName~\thesisFirstAuthorLastName\\Researcher}
\@ifundefined{thesisThirdAuthorName}
{\\[3\baselineskip]}
{
\\[3\baselineskip]
\@signbox{\thesisThirdTitleName\thesisThirdAuthorName~\thesisThirdAuthorLastName\\Researcher}
\@ifundefined{thesisFourthAuthorName}
{\\[3\baselineskip]}
{
\hspace{0.16\textwidth}\@signbox{\thesisFourthTitleName\thesisFourthAuthorName~\thesisFourthAuthorLastName\\Researcher}
\\[3\baselineskip]
}
}
}
\@advSignbox{\thesisAdv, \advDegree\\Advisor}
\end{tabbing}
%\vfill
\end{center}
\end{spacing}
\clearpage
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Entitled page layout II
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand{\entitlepageTwo}{
\thispagestyle{empty}
\begin{spacing}{1.15}
\begin{center}
Thesis\\
entitled\\
\@cpFont{\MakeUppercase{\thesisTitle}}
\\[\baselineskip]
was submitted to the Faculty of Engineering \& International College,\\
Mahidiol University\\
for the degree of Bachelor of Engineering (\thesisDepENG)\\
on\\
\thesisGradDate
\vfill
\noindent\@advSignbox{\Chair, \ChairDegree\\ Chair Committee}
\\[4\baselineskip]
\noindent\@advSignbox{\committeeI, \committeeIDegree\\Committee}
\\[4\baselineskip]
\noindent\@advSignbox{\committeeII, \committeeIIDegree\\Comittee}
\end{center}
\end{spacing}
\clearpage
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Biography page layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand{\biography}{        %Create Biography Page
\setcounter{page}{1}
\addcontentsline{toc}{chapter}{BIOGRAPHY}
\@biolayout{First}{Second}   
\@ifundefined{thesisThirdAuthorNameTH}
    {}
    {\@biolayout{Third}{Fourth}}
}


\newcommand{\@biolayout}[2]{    %Create List of Authors in Biography Page
%\thispagestyle{empty}
\begin{center}
\@cpFont{\textbf{\MakeUppercase{Biography}}}
\\[2\baselineskip]
\begin{tabbing}
NAME{\hspace{130pt}}\=\tabfill{\csname thesis#1TitleName\endcsname\csname thesis#1AuthorName\endcsname~\csname thesis#1AuthorLastName\endcsname}\\
DATE OF BIRTH \> \csname thesis#1AuthorBD\endcsname \\
BIRTHPLACE \> \csname thesis#1AuthorBP\endcsname\\
EDUCATION BACKGROUND \> \tabfill{\csname thesis#1AuthorHC\endcsname}\\
%            \> \tabfill{ปริญญาตรี ภาควิชา\thesisDepTH~คณะวิศวกรรมศาสตร์  มหาวิทยาลัยมหิดล}\\
MOBILE PHONE  \> \csname thesis#1AuthorTel\endcsname\\
E-MAIL \> \csname thesis#1AuthorEmail\endcsname
\@ifundefined{thesis#2AuthorNameTH}
{}
{
\\[3\baselineskip]
NAME{\hspace{130pt}}\=\tabfill{\csname thesis#2TitleName\endcsname\csname thesis#2AuthorName\endcsname~\csname thesis#2AuthorLastName\endcsname}\\
DATE OF BIRTH \> \csname thesis#2AuthorBD\endcsname \\
BIRTHPLACE \> \csname thesis#2AuthorBP\endcsname\\
EDUCATION BACKGROUND \> \tabfill{\csname thesis#2AuthorHC\endcsname}\\
%            \> \tabfill{ปริญญาตรี ภาควิชา\thesisDepTH~คณะวิศวกรรมศาสตร์  มหาวิทยาลัยมหิดล}\\
MOBILE PHONE  \> \csname thesis#2AuthorTel\endcsname\\
E-MAIL \> \csname thesis#2AuthorEmail\endcsname
}
\end{tabbing}
\end{center}
\clearpage
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Acknowledgement Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand{\acknowledgement}[1]{
%\thispagestyle{empty}
\addcontentsline{toc}{chapter}{ACKNOWLEDGEMENT}
\sloppy     %increase space between Thai words
\begin{center}
\@cpFont{\textbf{ACKNOWLEDGEMENT}
\\[1\baselineskip]    
}
\end{center}\par
\input{#1}\\\\\par
\hfill\pbox{\textwidth}{
    \thesisFirstTitleName\thesisFirstAuthorName\hspace{15pt}\thesisFirstAuthorLastName\\
    \@ifundefined{thesisSecondAuthorName}
    {}
    {\thesisSecondTitleName\thesisSecondAuthorName\hspace{15pt}\thesisSecondAuthorLastName\\}
    \@ifundefined{thesisThirdAuthorName}
    {}
    {\thesisThirdTitleName\thesisThirdAuthorName\hspace{15pt}\thesisThirdAuthorLastName\\}
    \@ifundefined{thesisFourthAuthorName}
    {}
    {\thesisFourthTitleName\thesisFourthAuthorName\hspace{15pt}\thesisFourthAuthorLastName}
}
\clearpage
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Abstract Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%Thai Abstract
\newenvironment{abstractTHLayout}
{
\renewcommand{\baselinestretch}{1.5}    % Set width between lines
    \addcontentsline{toc}{chapter}{บทคัดย่อ}
    \sloppy     %increase space between Thai words
    \fancyput(0.9cm,-25cm){           %   Set Page Frame (x,y) dimension 
        \setlength{\unitlength}{1cm}%
    	\framebox(15.15,23.85){}%
    } 
    \begin{tabbing}
        ชื่อโครงงาน \hspace{2.8cm}\=\thesisTitleTH\\
        ผู้วิจัย \> \thesisFirstTitleNameTH\thesisFirstAuthorNameTH\hspace{15pt}\thesisFirstAuthorLastNameTH\\
            \@ifundefined{thesisSecondAuthorNameTH}{}{\>\thesisSecondTitleNameTH\thesisSecondAuthorNameTH\hspace{15pt}\thesisSecondAuthorLastNameTH\\} 
            \@ifundefined{thesisThirdAuthorNameTH}{}{\>\thesisThirdTitleNameTH\thesisThirdAuthorNameTH\hspace{15pt}\thesisThirdAuthorLastNameTH\\} 
            \@ifundefined{thesisFourthAuthorNameTH}{}{\>\thesisFourthTitleNameTH\thesisFourthAuthorNameTH\hspace{15pt}\thesisFourthAuthorLastNameTH\\} 
        ปริญญา \> วิศวกรรมศาสตรบัณฑิต สาขาวิชา\thesisDepTH\\
        อาจารย์ที่ปรึกษา \> \thesisAdvTH\\
        สำเร็จการศึกษา \> \thesisGradDateTH
    \end{tabbing}
    \begin{center} 
    \@cpFont{\textbf{บทคัดย่อ}}
    \end{center}\par
}
{
    \\[1\baselineskip]
    \textbf{คำสำคัญ} :\thesisKeywordsTH
    \\[1\baselineskip]
    %\char\numexpr\getpagerefnumber{LastPage}+"E50  => This expression converting LastPage to an Integer but not working on 2 or more digits number. TODO: find the way to extract each digit and pass to the Arabic => Thai numeral converter 
    \totalPageTH~หน้า
    \clearpage     
}

\newcommand{\abstractTH}[1]{
    \begin{abstractTHLayout}
        \input{#1}
    \end{abstractTHLayout}
}
%====================================
%English Abstract
\newenvironment{abstractENGLayout}
{
    \addcontentsline{toc}{chapter}{ABSTRACT (ENGLISH)}
    \fancyput(0.9cm,-25cm){           %   Set Page Frame (x,y) dimension 
        \setlength{\unitlength}{1cm}%
	    \framebox(15.15,23.85){}%
    }
    \begin{tabbing}
        \centerline{\@cpFont{\MakeUppercase{\thesisTitle}}}\\[2\baselineskip]
        STUDENTS \hspace{2.8cm}\=\thesisFirstTitleName~\thesisFirstAuthorName\hspace{15pt}\thesisFirstAuthorLastName~ICCI\\
            \@ifundefined{thesisSecondAuthorName}{}{\>\thesisSecondTitleName~\thesisSecondAuthorName\hspace{15pt}\thesisSecondAuthorLastName~ICCI\\} 
            \@ifundefined{thesisThirdAuthorName}{}{\>\thesisThirdTitleName~\thesisThirdAuthorName\hspace{15pt}\thesisThirdAuthorLastName~ICCI\\} 
            \@ifundefined{thesisFourthAuthorName}{}{\>\thesisFourthTitleName~\thesisFourthAuthorName\hspace{15pt}\thesisFourthAuthorLastName ~ICCI\\} 
        DEGREE \> Bachelor of Engineering (\thesisDepENG)\\
        PROJECT ADVISOR \> \thesisAdv\\
        DATE OF GRADUATION \> \thesisGradDate
    \end{tabbing}
    \begin{center}
        \@cpFont{ABSTRACT}
    \end{center}\par
}
{
    \\[1\baselineskip]
    \textbf{KEYWORDS} :\thesisKeywords
    \\[1\baselineskip]
    \pageref{LastPage}~Pages\\
    \clearpage    
}
\newcommand{\abstractENG}[1]{
    \begin{abstractENGLayout}
        \input{#1}
    \end{abstractENGLayout}
}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Table of Contents Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\gappto\captionsenglish{\def\contentsname{CONTENTS}} %Set ToC title
\renewcommand\cfttoctitlefont{\hfill\@cpFont}        %set TOC title font and left position
\renewcommand\cftaftertoctitle{\hfill}                  %Set TOC title right position
\setlength{\cftbeforetoctitleskip}{-1.2em}  %set space before TOC title
\setlength{\cftaftertoctitleskip}{2\baselineskip}   %set space after TOC title
\setlength{\cftbeforechapskip}{0pt}     %set space between TOC chapter list
\setlength{\cftbeforesecskip}{0pt}     %set space between ToC section list
\setlength{\cftbeforesubsecskip}{0pt}     %set space between ToC subsection list
%\setlength{\cftsecindent}{2cm}      %set subsection indentation in ToC
%\setlength{\cftsubsecindent}{4cm}   %set subsubsection indentation in ToC
%\setlength{\cftsubsubsecindent}{0em}   %set subsubsubsection indentation in ToC
\tocloftpagestyle{fancy}
%\addtocontents{toc}{\protect\thispagestyle{plain}}  %set header in First page of TOC 
\addtocontents{toc}{~\hfill{\bfseries Page}\par}  %Add หน้า on top of page number
\renewcommand{\cftchappresnum}{\chaptertitlename~}    %Add บทที่ หรือ ภาคผนวก in front of chapter number
%=== Remove comment then replace '1em' by \@chNumLen if want to use default setting ====
% \newlength{\@chNumLen} % length variable 
% \settowidth{\@chNumLen}{\bfseries\cftchappresnum\cftchapaftersnum} % Set new space (@chNumLen) = "+chappresnum+chapaftersnum" 
\renewcommand{\cftdot}{}    %no dots line in TOC
\setcounter{tocdepth}{2}    %Set depth of section in TOC

%====ToC Chapter list style setting=========
\newlength{\chapToCPrefix}  %Define new length variable
\settowidth{\chapToCPrefix}{\cftchappresnum}    %Set length = chaptertitlename
\addtolength{\cftchapnumwidth}{\dimexpr\chapToCPrefix +2em}    %Set new space between Chapter prefix and title




%=== ToC Appendix list style setting========= 
%**** See in Appendix Layout section *******

%=== ToC Bibliography style setting========= 
%**** See in Bibliography Layout section *******

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom List of Figures Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%====== List of Figures ======
\gappto\captionsenglish{\def\listfigurename{LIST OF FIGURES}}
\renewcommand\cftloftitlefont{\hfill\@cpFont}        %set LoF title font and left position
\renewcommand\cftafterloftitle{\hfill}                  %Set LoF title right position
\setlength{\cftbeforeloftitleskip}{-0.95em}  %set space before LoF title
\patchcmd{\@chapter}{\addtocontents{lof}{\protect\addvspace{10\p@}}}{}{}{} %remove space break between chapter in LoF
\setlength{\cftafterloftitleskip}{2\baselineskip}   %set space after LoF title
\setlength{\cftbeforefigskip}{0pt}     %set space between LoF list
\setlength{\cftfigindent}{0pt}      %Set LoT indentation
%\addtocontents{lof}{\protect\thispagestyle{plain}}  %set header of LoF first page: Note, the "plain style" is set in Chapter section => Chapter header
\addtocontents{lof}{\noindent\bfseries{Figure}\hfill{\bfseries Page}\par}  %Add หน้า on top of page number
%\renewcommand{\cftfigpresnum}{Figure }    %Add บทที่ in front of chapter number
\newlength{\lofPrefix}          %Define new length variable 
\settowidth{\lofPrefix}{\cftfigpresnum} %Add length of "cftfigpresnum" to variable
\setlength{\cftfignumwidth}{\dimexpr\lofPrefix+2.5em}   %Adjust space between prefix and figture title

%====== Figure Caption ======
%\captionsetup[figure]{name= \bfseries รูปที่~}    %Change Figure caption to รูปที่
\captionsetup[figure]{skip=0pt}      %Space between caption and figure
\captionsetup[figure]{labelsep=space}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom List of Tables and Table Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%====== List of Tables ======
\gappto\captionsenglish{\def\listtablename{LIST OF TABLES}} %Set Lot Title
\renewcommand\cftlottitlefont{\hfill\@cpFont}        %set LoT title font and left position
\renewcommand\cftafterlottitle{\hfill}                  %Set LoT title right position
\setlength{\cftbeforelottitleskip}{-1.2em}  %set space before LoT title
\setlength{\cftafterlottitleskip}{2\baselineskip}   %set space after LoT title
\patchcmd{\@chapter}{\addtocontents{lot}{\protect\addvspace{10\p@}}}{}{}{} %remove space break between chapter in LoT
\setlength{\cftbeforetabskip}{0pt}     %set space between LoT list
\setlength{\cfttabindent}{0pt}      %Set LoT indentation
%\addtocontents{lot}{\protect\thispagestyle{plain}}  %set header of LoT first page 
\addtocontents{lot}{{\noindent\bfseries Table}\hfill{\bfseries Page}\par}  %Add Page on top of page number
%\renewcommand{\cfttabpresnum}{ตารางที่~}    %Add บทที่ in front of chapter number
\newlength{\lotPrefix}          %Define new length variable 
\settowidth{\lotPrefix}{\cfttabpresnum} %Add length of "cfttabpresnum" to variable
\setlength{\cfttabnumwidth}{\dimexpr\lotPrefix+2.5em}   %Adjust space between prefix and table title

%====== Table Caption ======
%\captionsetup[table]{name= \bfseries ตารางที่~}    %Change Table captionp to ตาราง
\captionsetup[table]{skip=0pt}      %Space between caption and table
\captionsetup[table]{labelsep=space, justification=raggedright, singlelinecheck=off} %Set left align table caption

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Listing Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\renewcommand{\lstlistingname}{อัลกอริทึม}% Listing -> อัลกอริทึม
\renewcommand{\lstlistlistingname}{สารบัญ\lstlistingname}% List of Listings ->สารบัญอัลกอริทึม

\lstdefinestyle{mystyle}{
    backgroundcolor=\color{backcolour},   
    commentstyle=\color{codegreen},
    keywordstyle=\color{magenta},
    numberstyle=\tiny\color{codegray},
    stringstyle=\color{codepurple},
    breakatwhitespace=false,         
    breaklines=true,                 
    captionpos=t,       % Caption position on the top (t) , 'b' for below             
    keepspaces=true,                 
    numbers=left,                    
    numbersep=5pt,                  
    showspaces=false,                
    showstringspaces=false,
    showtabs=false,                  
    tabsize=2,
    basicstyle=\linespread{0.8}\footnotesize, 
    xleftmargin=.02\textwidth, 
    xrightmargin=.01\textwidth,
    frame = single,
}
\lstset{style=mystyle} 
\DeclareCaptionFormat{listing}{#1#2#3\par}
\captionsetup[lstlisting]{format=listing,singlelinecheck=false, margin=0pt,labelsep=space, labelfont=bf}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Chapter Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\renewcommand{\chaptermark}[1]{\markboth{#1}{}} %Remove "Chapter Title" from from leftmark parameter  
\gappto\captionsenglish{\def\chaptername{CHAPTER}}   %Change chapter title
\titleformat{\chapter}
    [display]     %Title display style {opts: hang, display, block, wrap, ... See in titlesec document} 
    {\centering\@chapterFont}    %Text format for Chapter title (20pt)
    {\chaptertitlename~\thechapter}    %Text of Chapter Title
    {0pt}         % Width between Chapter title and Chapter name 
    {\@chapterFont\MakeUppercase}  %Text format for Chapter name

\titlespacing*{\chapter}
    {0pt}
    {0em}
    {1.5\baselineskip}   %Chapter title margin

%  \let\OldChapter\chapter
%  \newcommand{\testchapter}[1]{%
%      \OldChapter{\uppercase{#1}}%
%      \def\cpTitle{#1}%
%  }



%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Section Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\setcounter{secnumdepth}{3}     %set depth of number appearing in front of section, subsection, and subsubsection 

\newcommand\Xsection{      % Note that, titleformat and titlespace do not meet requirements of section indentation then rewrite section cmd is necessary
    \leftskip 0pt\@startsection {section}{1}    %command before starting the section, and Section level
    {0pt}           % Left margin of section header
    {\baselineskip}           % Top margin of section header
    {0.1pt}         % Lower margin of section header (cannot be 0)
    {\@secFont}     % Command before starting section title
}
\renewcommand\section[1]{\Xsection{#1}\setlength{\parindent}{1.6cm}} %command before starting subsection title and section content indentation

%-------------------------------------------------
\renewcommand*{\@seccntformat}[1]   %Space between section/subsection/subsubsection title and its number
{%
    \ifnum\pdfstrcmp{#1}{section}=0
       \csname the#1\endcsname\hspace{0.5em} 
    \else 
        \ifnum\pdfstrcmp{#1}{subsection}=0
            \csname the#1\endcsname\hspace{0.5em} 
        \else
            \csname the#1\endcsname\hspace{0.5em} 
        \fi
  \fi% 
} 

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Subsection Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand\Xsubsection{% Note that, titleformat and titlespace do not meet requirements of section indentation then rewrite section cmd is necessary
    \@startsection{subsection}{2}   %Command before starting Subsection title, and Subsection level
    {0pt} %Left margin of Subsection title
    {\baselineskip}   %Top margin of Subsection title
    {0.1pt}   %Below margin of Subsection title
    {\@subSecFont\leftskip 1.6cm}  %Command before starting subsection name
} 
\renewcommand\subsection[1]{\Xsubsection{#1}\setlength{\parindent}{2.8cm}} %command before starting subsection title and subsection content indentation

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Subsubsection Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\newcommand\Xsubsubsection{      % Note that, titleformat and titlespace do not meet requirements of section indentation then rewrite section cmd is necessary
    \@startsection {subsubsection}{3}    %command before starting the section, and Section level
    {0cm}           % Left margin of subsubsection header
    {\baselineskip}           % Top margin of subsubsection header
    {0.1pt}         % Lower margin of subsubsection header (cannot be 0)
    {\@subSecFont\leftskip 3.2cm}     % Command before starting subsubsection title
}
\renewcommand\subsubsection[1]{\Xsubsubsection{#1}\setlength{\parindent}{4.7cm}} %command before starting subsection title and subsection content indentation


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Appendix Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%==== ToC Appendix List style setting======
\newlength{\appendixToCPrefix}
\settowidth{\appendixToCPrefix}{\appendixname}
\makeatletter
\g@addto@macro\appendix{%
    \addtocontents{toc}{\protect\setcounter{tocdepth}{0}}       %Set Appendix toc depth to 0
    \renewcommand{\chaptertitlename}{APPENDIX}
%    \renewcommand*{\thechapter}{\thaiAlph{chapter}}        %Thai Alphabet Number of Chapter
    \titleformat{\chapter}
        [display]     %Title display style {opts: hang, display, block, wrap, ... See in titlesec document} 
        {\centering\@chapterFont}    %Text format for Chapter title (20pt)
        {\chaptertitlename~\thechapter.}    %Text of Chapter Title
        {0pt}         % Width between Chapter title and Chapter name 
        {\@chapterFont}  %Text format for Chapter name
    
    
    \addtocontents{toc}{%Add Appendix to ToC
        \protect\renewcommand{\protect\cftchappresnum}{\MakeUppercase{\appendixname~}}%
        \protect\renewcommand{\protect\cftchapnumwidth}{\dimexpr\appendixToCPrefix+2.5em}%
    }%
}
\makeatother

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Bibliography Layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\addto\captionsenglish{\renewcommand{\bibname}{REFERENCES}} %Set Bibliography Title to be References

\setlength\bibindent{2em}   %set second line indentation width of reference
\makeatletter           %Reconfig bibnat to use indentation with number-style (normally will work only author-year style)
\renewcommand\NAT@bibsetnum[1]{\settowidth\labelwidth{\@biblabel{#1}}%
   \setlength{\leftmargin}{\bibindent}\addtolength{\leftmargin}{\dimexpr\labelwidth+\labelsep\relax}%
   \setlength{\itemindent}{-\bibindent}%
   \setlength{\listparindent}{\itemindent}
\setlength{\itemsep}{\bibsep}\setlength{\parsep}{\z@}%
   \ifNAT@openbib
     \addtolength{\leftmargin}{\bibindent}%
     \setlength{\itemindent}{-\bibindent}%
     \setlength{\listparindent}{\itemindent}%
     \setlength{\parsep}{0pt}%
   \fi
}
\makeatother


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%Custom Commands
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\makeatletter
%Font command (Font size ratio = 1.2)
\newcommand{\@cpFont}[1]{{\textbf{\fontsize{14}{16.8}#1}}}  %Cover Page Bold font (14pt); use {{xx}}
\newcommand{\@cpNormalFont}[1]{{\fontsize{14}{16.8}#1}}  %Cover Page font (14pt); use {{xx}}
\newcommand{\@titleFont}[1]{{\fontsize{15}{18} #1}}  %Title Page font (20pt); use {{xx}}
\newcommand{\@headerFont}[1]{{\fontsize{10}{12}#1}}  %header font size
\newcommand{\@chapterFont}[1]{\bfseries\fontsize{15.04}{18.05}#1} %Chapter title font size (20pt)
\newcommand{\@secFont}[1]{\bfseries\fontsize{13.5}{16.2}#1} %Section title font size (18pt)
\newcommand{\@subSecFont}[1]{\bfseries\fontsize{12}{14.4}#1} %Subsection title font size (16pt)

\def\@sigULs{\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_}
%=============================
%Signature Set 
\newcommand{\@signbox}[1]{\parbox[t]{70mm}{\raggedright\@sigULs\\#1}} %create signature line + name 
\newcommand{\@advSignbox}[1]{\parbox[t]{147mm}{\raggedright\@sigULs\\#1}} %create Advisor signature line + name 

\newcommand\tabfill[1]{     %Text wrapper in tabbing environment
  \dimen@\linewidth
  \advance\dimen@\@totalleftmargin
  \advance\dimen@-\dimen\@curtab
  \parbox[t]\dimen@{\raggedright #1\ifhmode\strut\fi}%
}

%=============================
\def\@thainumber#1{\expandafter\@@thainumber\number #1\@nil}    %Convert Numbers to Thai numerals 
\def\@@thainumber#1{%
  \ifx#1\@nil
  \else
  \char\numexpr#1+"E50\relax
  \expandafter\@@thainumber\fi}
\def\thaicounter#1{\expandafter\@thainumber\csname c@#1\endcsname}
\def\thainumeral#1{\@@thainumber#1\@nil}
%=============================
\newcolumntype{Y}{>{\centering\arraybackslash}X} %Define new column type (Centering with textwidth)

\makeatother
