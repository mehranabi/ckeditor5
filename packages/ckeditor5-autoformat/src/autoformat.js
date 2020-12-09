/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module autoformat/autoformat
 */

import blockAutoformatEditing from './blockautoformatediting';
import inlineAutoformatEditing from './inlineautoformatediting';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

/**
 * Enables a set of predefined autoformatting actions.
 *
 * For a detailed overview, check the {@glink features/autoformat Autoformatting feature documentation}
 * and the {@glink api/autoformat package page}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class Autoformat extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'Autoformat';
	}

	/**
	 * @inheritDoc
	 */
	afterInit() {
		this._addListAutoformats();
		this._addBasicStylesAutoformats();
		this._addHeadingAutoformats();
		this._addBlockQuoteAutoformats();
		this._addCodeBlockAutoformats();
	}

	/**
	 * Adds autoformatting related to the {@link module:list/list~List}.
	 *
	 * When typed:
	 * - `* ` or `- ` &ndash; A paragraph will be changed to a bulleted list.
	 * - `1. ` or `1) ` &ndash; A paragraph will be changed to a numbered list ("1" can be any digit or a list of digits).
	 *
	 * @private
	 */
	_addListAutoformats() {
		const commands = this.editor.commands;

		if ( commands.get( 'bulletedList' ) ) {
			blockAutoformatEditing( this.editor, this, /^[*-]\s$/, 'bulletedList' );
		}

		if ( commands.get( 'numberedList' ) ) {
			blockAutoformatEditing( this.editor, this, /^1[.|)]\s$/, 'numberedList' );
		}
	}

	/**
	 * @param {RegExp} regExp The regular expression matching text to format.
	 * Contrary to default behavior, this regular expression must provide *four* groups.
	 * First group should hold a separator that limits the scope of when the autoformatting is applied.
	 *
	 * @private
	 */
	_matchAutoformatWithSeparators( regExp ) {
		return text => {
			let result;
			const remove = [];
			const format = [];

			while ( ( result = regExp.exec( text ) ) !== null ) {
				// There should be full match and 4 capture groups.
				//   * Left separator group (whitespace or punctuation),
				//   * Left delimiter group (`_` or `*` - single or double).
				//   * A content to format.
				//   * Right delimiter group.
				if ( result && result.length < 5 ) {
					break;
				}

				let {
					index,
					'1': leftSep,
					'2': leftDel,
					'3': content,
					'4': rightDel
				} = result;

				// Separator should *not* count for the removal or formatting.
				// We are offsetting the index by separator length.
				index += leftSep.length;

				// Start and End offsets of delimiters to remove.
				const delStart = [
					index,
					index + leftDel.length
				];
				const delEnd = [
					index + leftDel.length + content.length,
					index + leftDel.length + content.length + rightDel.length
				];

				remove.push( delStart );
				remove.push( delEnd );

				format.push( [ index + leftDel.length, index + leftDel.length + content.length ] );
			}

			return {
				remove,
				format
			};
		};
	}

	/**
	 * Adds autoformatting related to the {@link module:basic-styles/bold~Bold},
	 * {@link module:basic-styles/italic~Italic}, {@link module:basic-styles/code~Code}
	 * and {@link module:basic-styles/strikethrough~Strikethrough}
	 *
	 * When typed:
	 * - `**foobar**` &ndash; `**` characters are removed and `foobar` is set to bold,
	 * - `__foobar__` &ndash; `__` characters are removed and `foobar` is set to bold,
	 * - `*foobar*` &ndash; `*` characters are removed and `foobar` is set to italic,
	 * - `_foobar_` &ndash; `_` characters are removed and `foobar` is set to italic,
	 * - ``` `foobar` &ndash; ``` ` ``` characters are removed and `foobar` is set to code,
	 * - `~~foobar~~` &ndash; `~~` characters are removed and `foobar` is set to strikethrough.
	 *
	 * @private
	 */
	_addBasicStylesAutoformats() {
		const commands = this.editor.commands;

		if ( commands.get( 'bold' ) ) {
			const boldCallback = getCallbackFunctionForInlineAutoformat( this.editor, 'bold' );
			inlineAutoformatEditing(
				this.editor,
				this,
				this._matchAutoformatWithSeparators( /(\s)(\*\*)([^*]+)(\*\*)(?:\s)/g ),
				boldCallback
			);
			inlineAutoformatEditing(
				this.editor,
				this,
				this._matchAutoformatWithSeparators( /(\s)(__)([^_]+)(__)(?:\s)/g ),
				boldCallback
			);
		}

		if ( commands.get( 'italic' ) ) {
			const italicCallback = getCallbackFunctionForInlineAutoformat( this.editor, 'italic' );

			// The italic autoformatter cannot be triggered by the bold markers,
			// so we need to make sure there is a separator before the delimiter.
			inlineAutoformatEditing(
				this.editor,
				this,
				this._matchAutoformatWithSeparators( /(^|\s)(\*)([^*_]+)(\*)(?:\s)/g ),
				italicCallback
			);
			inlineAutoformatEditing(
				this.editor,
				this,
				this._matchAutoformatWithSeparators( /(^|\s)(_)([^_]+)(_)(?:\s)/g ),
				italicCallback
			);
		}

		if ( commands.get( 'code' ) ) {
			const codeCallback = getCallbackFunctionForInlineAutoformat( this.editor, 'code' );

			inlineAutoformatEditing( this.editor, this, /(`)([^`]+)(`)$/g, codeCallback );
		}

		if ( commands.get( 'strikethrough' ) ) {
			const strikethroughCallback = getCallbackFunctionForInlineAutoformat( this.editor, 'strikethrough' );

			inlineAutoformatEditing( this.editor, this, /(~~)([^~]+)(~~)$/g, strikethroughCallback );
		}
	}

	/**
	 * Adds autoformatting related to {@link module:heading/heading~Heading}.
	 *
	 * It is using a number at the end of the command name to associate it with the proper trigger:
	 *
	 * * `heading` with value `heading1` will be executed when typing `#`,
	 * * `heading` with value `heading2` will be executed when typing `##`,
	 * * ... up to `heading6` and `######`.
	 *
	 * @private
	 */
	_addHeadingAutoformats() {
		const command = this.editor.commands.get( 'heading' );

		if ( command ) {
			command.modelElements
				.filter( name => name.match( /^heading[1-6]$/ ) )
				.forEach( modelName => {
					const level = modelName[ 7 ];
					const pattern = new RegExp( `^(#{${ level }})\\s$` );

					blockAutoformatEditing( this.editor, this, pattern, () => {
						// Should only be active if command is enabled and heading style associated with pattern is inactive.
						if ( !command.isEnabled || command.value === modelName ) {
							return false;
						}

						this.editor.execute( 'heading', { value: modelName } );
					} );
				} );
		}
	}

	/**
	 * Adds autoformatting related to {@link module:block-quote/blockquote~BlockQuote}.
	 *
	 * When typed:
	 * * `> ` &ndash; A paragraph will be changed to a block quote.
	 *
	 * @private
	 */
	_addBlockQuoteAutoformats() {
		if ( this.editor.commands.get( 'blockQuote' ) ) {
			blockAutoformatEditing( this.editor, this, /^>\s$/, 'blockQuote' );
		}
	}

	/**
	 * Adds autoformatting related to {@link module:code-block/codeblock~CodeBlock}.
	 *
	 * When typed:
	 * - `` ``` `` &ndash; A paragraph will be changed to a code block.
	 *
	 * @private
	 */
	_addCodeBlockAutoformats() {
		if ( this.editor.commands.get( 'codeBlock' ) ) {
			blockAutoformatEditing( this.editor, this, /^```$/, 'codeBlock' );
		}
	}
}

// Helper function for getting `inlineAutoformatEditing` callbacks that checks if command is enabled.
//
// @param {module:core/editor/editor~Editor} editor
// @param {String} attributeKey
// @returns {Function}
function getCallbackFunctionForInlineAutoformat( editor, attributeKey ) {
	return ( writer, rangesToFormat ) => {
		const command = editor.commands.get( attributeKey );

		if ( !command.isEnabled ) {
			return false;
		}

		const validRanges = editor.model.schema.getValidRanges( rangesToFormat, attributeKey );

		for ( const range of validRanges ) {
			writer.setAttribute( attributeKey, true, range );
		}

		// After applying attribute to the text, remove given attribute from the selection.
		// This way user is able to type a text without attribute used by auto formatter.
		writer.removeSelectionAttribute( attributeKey );
	};
}
